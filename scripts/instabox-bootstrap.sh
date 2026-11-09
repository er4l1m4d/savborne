#!/usr/bin/env bash
#
# instabox-bootstrap.sh
#
# Runs ON the InstaBox machine. Installs Node (if needed), OpenCode, and
# OpenChamber; clones every project from the bundle manifest; imports provider
# credentials and sessions; installs two systemd services.
#
# Usage (on the VM):
#   bash /data/home/instabox-bootstrap.sh
#
# Optional overrides:
#   BUNDLE=/data/home/.instabox-bundle.tgz
#   WORK=/data/home/work
#   OPENCODE_PORT=4096
#   OPENCHAMBER_PORT=3000
#
set -euo pipefail

BUNDLE="${BUNDLE:-/data/home/.instabox-bundle.tgz}"
WORK="${WORK:-/data/home/work}"
STAGE="${STAGE:-/data/home/.instabox-stage}"
OPENCODE_PORT="${OPENCODE_PORT:-4096}"
OPENCHAMBER_PORT="${OPENCHAMBER_PORT:-3000}"
CONFIG_DIR="$HOME/.config/instabox"

log()  { printf '\n==> %s\n' "$*"; }
warn() { printf 'warning: %s\n' "$*" >&2; }
die()  { printf 'error: %s\n' "$*" >&2; exit 1; }

[ "$(id -u)" -ne 0 ] || die "Run this as the machine user, not root."
[ -f "$BUNDLE" ] || die "Bundle not found: $BUNDLE (run the preflight on the PC first)"

case "$HOME" in
  /data/home/*) ;;
  *) warn "HOME=$HOME is not under /data/home; files may not survive a stop/start." ;;
esac

mkdir -p "$WORK" "$CONFIG_DIR" /data/tmp

# ------------------------------------------------------------------ Node 24
# OpenChamber needs Node.js 24.14 or newer. Keep our own copy on /data so we
# never fight the template's system Node.
NODE_BIN_DIR=""
ensure_node() {
  local want_major=24 want_minor=14 v major minor arch tarball url tmpdir extracted
  if command -v node >/dev/null 2>&1; then
    v="$(node -p 'process.versions.node')"
    major="${v%%.*}"
    minor="$(printf '%s' "$v" | cut -d. -f2)"
    if [ "$major" -gt "$want_major" ] || { [ "$major" -eq "$want_major" ] && [ "$minor" -ge "$want_minor" ]; }; then
      NODE_BIN_DIR="$(dirname "$(command -v node)")"
      return 0
    fi
  fi

  log "Installing Node 24 under $HOME/.local/node"
  mkdir -p "$HOME/.local"
  case "$(uname -m)" in
    x86_64)         arch=x64 ;;
    aarch64|arm64)  arch=arm64 ;;
    *) die "Unsupported architecture: $(uname -m)" ;;
  esac

  tarball="$(curl -fsSL https://nodejs.org/dist/latest-v24.x/ \
    | grep -oE "node-v24\.[0-9]+\.[0-9]+-linux-${arch}\.tar\.gz" \
    | head -1)"
  [ -n "$tarball" ] || die "Could not find a Node 24 tarball for linux-${arch}"
  url="https://nodejs.org/dist/latest-v24.x/$tarball"

  tmpdir="$(mktemp -d)"
  curl -fsSL "$url" -o "$tmpdir/node.tar.gz"
  tar -xzf "$tmpdir/node.tar.gz" -C "$tmpdir"
  extracted="$(find "$tmpdir" -maxdepth 1 -type d -name 'node-v24*' | head -1)"
  [ -n "$extracted" ] || die "Node tarball did not contain a node-v24 directory"

  rm -rf "$HOME/.local/node"
  mv "$extracted" "$HOME/.local/node"
  rm -rf "$tmpdir"

  NODE_BIN_DIR="$HOME/.local/node/bin"
  export PATH="$NODE_BIN_DIR:$PATH"
}

export PATH="$HOME/.local/bin:/opt/npm/bin:/usr/local/bin:/usr/bin:/bin:$PATH"
ensure_node
export PATH="$NODE_BIN_DIR:$PATH"

node --version
npm --version

# ------------------------------------------------------------------ OpenCode
if ! command -v opencode >/dev/null 2>&1; then
  log "Installing OpenCode CLI"
  npm install -g @opencode/cli
fi
OPENCODE_BIN="$(command -v opencode)"
[ -n "$OPENCODE_BIN" ] || die "opencode was not installed"
"$OPENCODE_BIN" --version

# ------------------------------------------------------------------ OpenChamber
if ! command -v openchamber >/dev/null 2>&1; then
  log "Installing OpenChamber"
  # Install the package directly instead of the convenience script, which
  # prefers pnpm/bun when present and can put the binary on a PATH we do not
  # control. npm's global prefix is /opt/npm on this image and is on PATH.
  npm install -g @openchamber/web
fi
OPENCHAMBER_BIN="$(command -v openchamber || true)"
if [ -z "$OPENCHAMBER_BIN" ]; then
  # npm's global bin may still be outside PATH on a non-standard image.
  NPM_PREFIX="$(npm prefix -g 2>/dev/null || true)"
  if [ -n "$NPM_PREFIX" ] && [ -x "$NPM_PREFIX/bin/openchamber" ]; then
    OPENCHAMBER_BIN="$NPM_PREFIX/bin/openchamber"
  fi
fi
[ -n "$OPENCHAMBER_BIN" ] || die "openchamber was not installed; run 'npm install -g @openchamber/web' manually and re-run this script"
"$OPENCHAMBER_BIN" --version 2>/dev/null || true

# ------------------------------------------------------------------ unpack
log "Unpacking bundle"
rm -rf "$STAGE"
mkdir -p "$STAGE"
tar -xzf "$BUNDLE" -C "$STAGE"
[ -f "$STAGE/manifest.json" ] || die "Bundle has no manifest.json"

read_manifest() {
  node -e "$1" "$STAGE/manifest.json"
}

GIT_NAME="$(read_manifest 'const fs=require("fs");const m=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));process.stdout.write(m.git.name||"instabox")')"
GIT_EMAIL="$(read_manifest 'const fs=require("fs");const m=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));process.stdout.write(m.git.email||"instabox@localhost")')"
git config --global user.name  "$GIT_NAME"
git config --global user.email "$GIT_EMAIL"

# ------------------------------------------------------------------ projects
log "Cloning / updating projects under $WORK"
while IFS=$'\t' read -r local_name vm_dir remote branch; do
  [ -n "$vm_dir" ] || continue
  dest="$WORK/$vm_dir"
  printf '\n  - %s (%s)\n' "$vm_dir" "$branch"

  if [ -d "$dest/.git" ]; then
    git -C "$dest" fetch --all --prune
    if git -C "$dest" show-ref --verify --quiet "refs/heads/$branch"; then
      git -C "$dest" checkout "$branch"
    else
      git -C "$dest" checkout -B "$branch" "origin/$branch"
    fi
    git -C "$dest" pull --ff-only || warn "pull failed for $vm_dir (local changes?)"
  else
    git clone "$remote" "$dest"
    git -C "$dest" checkout "$branch" 2>/dev/null \
      || git -C "$dest" checkout -B "$branch" "origin/$branch"
  fi
done < <(read_manifest '
  const fs=require("fs");
  const m=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
  for (const p of m.projects||[]) console.log([p.localName,p.vmDir,p.remote,p.branch].join("\t"));
')

# ------------------------------------------------------------------ auth
if [ -d "$STAGE/auth" ]; then
  log "Importing provider credentials"
  for f in "$STAGE"/auth/*.json; do
    [ -e "$f" ] || continue
    printf '  - %s\n' "$(basename "$f" .json)"
    "$OPENCODE_BIN" auth import "$f" || warn "auth import failed for $f"
  done
fi

if [ -f "$STAGE/env/providers.env" ]; then
  log "Installing environment credentials"
  install -m 600 "$STAGE/env/providers.env" "$CONFIG_DIR/providers.env"
fi

# Stop the shared background service that auth/session commands may have
# started, so it does not compete with our dedicated server.
"$OPENCODE_BIN" service stop >/dev/null 2>&1 || true

# ------------------------------------------------------------------ sessions
log "Importing sessions"
while IFS=$'\t' read -r sid vm_dir file title; do
  [ -n "$sid" ] || continue
  if [ "$vm_dir" = "." ] || [ -z "$vm_dir" ]; then
    target="$WORK"
  else
    target="$WORK/$vm_dir"
  fi
  printf '  - %s -> %s\n' "$sid" "$target"
  "$OPENCODE_BIN" session import "$STAGE/$file" --directory "$target" \
    || warn "session import failed: $sid"
done < <(read_manifest '
  const fs=require("fs");
  const m=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
  for (const s of m.sessions||[]) console.log([s.id,s.vmDirectory,s.file,s.title||""].join("\t"));
')

"$OPENCODE_BIN" service stop >/dev/null 2>&1 || true

# ------------------------------------------------------------------ password
PASS_FILE="$CONFIG_DIR/openchamber-password"
if [ ! -f "$PASS_FILE" ]; then
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex 24 > "$PASS_FILE"
  else
    head -c 24 /dev/urandom | base64 | tr -d '\n' > "$PASS_FILE"
  fi
  chmod 600 "$PASS_FILE"
fi

cat > "$CONFIG_DIR/openchamber-start.sh" <<EOF
#!/usr/bin/env bash
set -euo pipefail
exec "$OPENCHAMBER_BIN" --host 0.0.0.0 --port $OPENCHAMBER_PORT --ui-password "\$(cat "$PASS_FILE")"
EOF
chmod 700 "$CONFIG_DIR/openchamber-start.sh"

RUN_USER="$(id -un)"
RUN_GROUP="$(id -gn)"

# ------------------------------------------------------------------ systemd
log "Installing systemd services"

sudo tee /etc/systemd/system/opencode.service >/dev/null <<EOF
[Unit]
Description=OpenCode server (InstaBox)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=$RUN_USER
Group=$RUN_GROUP
WorkingDirectory=$WORK
Environment=HOME=$HOME
Environment=PATH=$NODE_BIN_DIR:/opt/npm/bin:/usr/local/bin:/usr/bin:/bin:$HOME/.local/bin
Environment=TMPDIR=/data/tmp
EnvironmentFile=-$CONFIG_DIR/providers.env
ExecStart=$OPENCODE_BIN serve --hostname 0.0.0.0 --port $OPENCODE_PORT
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

sudo tee /etc/systemd/system/openchamber.service >/dev/null <<EOF
[Unit]
Description=OpenChamber web UI (InstaBox)
After=network-online.target opencode.service
Wants=network-online.target
Requires=opencode.service

[Service]
Type=simple
User=$RUN_USER
Group=$RUN_GROUP
WorkingDirectory=$WORK
Environment=HOME=$HOME
Environment=PATH=$NODE_BIN_DIR:/opt/npm/bin:/usr/local/bin:/usr/bin:/bin:$HOME/.local/bin
Environment=TMPDIR=/data/tmp
Environment=OPENCODE_HOST=http://127.0.0.1:$OPENCODE_PORT
Environment=OPENCODE_SKIP_START=true
ExecStart=$CONFIG_DIR/openchamber-start.sh
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now opencode.service || warn "opencode.service failed to start"
sleep 2
sudo systemctl --no-pager --full status opencode.service || true

sudo systemctl enable --now openchamber.service || warn "openchamber.service failed to start"
sleep 3
sudo systemctl --no-pager --full status openchamber.service || true

# ------------------------------------------------------------------ health
log "Health checks"
if curl -fsS "http://127.0.0.1:$OPENCODE_PORT/api/info" >/dev/null 2>&1; then
  echo "OpenCode API: OK"
else
  warn "OpenCode API did not answer on 127.0.0.1:$OPENCODE_PORT"
fi

code="$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$OPENCHAMBER_PORT/" || true)"
echo "OpenChamber HTTP: ${code:-no answer}"

# ------------------------------------------------------------------ cleanup
if command -v shred >/dev/null 2>&1; then
  shred -u "$STAGE"/auth/*.json "$STAGE"/env/* 2>/dev/null || true
fi
rm -rf "$STAGE" "$BUNDLE"

cat <<EOF

Done.

  Projects:        $WORK
  OpenCode:        http://127.0.0.1:$OPENCODE_PORT
  OpenChamber:     http://127.0.0.1:$OPENCHAMBER_PORT
  UI password:     $PASS_FILE
  Env credentials: $CONFIG_DIR/providers.env

Next:
  1. Authenticate GitHub on this machine (once):
       gh auth login
     If gh is missing: sudo apt-get update && sudo apt-get install -y gh

  2. On the PC, publish the ports:
       instabox port publish <machine> $OPENCHAMBER_PORT --private
       instabox port publish <machine> $OPENCODE_PORT --private

  3. Open the OpenChamber link on the phone, then add it to the home screen.

Remember: never 'instabox stop' this machine. Let it auto-pause; the next
request to a published port wakes it.
EOF
