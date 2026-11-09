# OpenCode on InstaBox

Run one OpenCode server on an InstaBox `agent-browser` machine, with every
project in `my builds` cloned under `/data/home/work`. The PC, the desktop app,
and the phone are clients of that one server, so sessions are shared by
definition.

```text
InstaBox VM (agent-browser, 4 vCPU / 8 GB, /data persists)
├─ /data/home/work/<project>            one clone per repo
├─ opencode serve 0.0.0.0:4096          one session database
└─ openchamber    0.0.0.0:3000          UI over that server (no second agent)
        │
        ├─ private port 3000 → phone (OpenChamber PWA)
        └─ public port 4096  → native app/API (Basic auth)
```

OpenCode 2 requires a password on its API. The bootstrap generates one at
`/data/home/.config/instabox/opencode.env`; OpenChamber reads the same file, and
the native app uses it as Basic auth.

> **Free-plan reality.** The machine pauses after 30 idle minutes and keeps its
> memory and processes. A request to a published port wakes it (the request
> waits up to ~45 s; you may see one `503` and need to refresh). Continuous
> runtime is capped at 8 hours, followed by a 5–20 minute cooldown. **Never run
> `instabox stop`** — a stop kills the server. Let it auto-pause.

---

## Prerequisites

On the PC:

- Windows 10+ with PowerShell 5.1 or newer
- Git for Windows (`git`)
- Node.js 20+ (`node`)
- OpenCode CLI (`npm install -g @opencode/cli`, V2). The bootstrap replaces the
  template's 1.19.5 binary if it finds one.
- InstaBox CLI (`npm install -g instabox`) and a signed-in account (`instabox login`)

On the InstaBox account:

- An existing machine, or create one:

  ```powershell
  instabox create --name openode-anywhere --template agent-browser
  ```

  The free plan only permits `agent-browser`, `android`, `omarchy`, and `ci`.
  `agent-browser` is the right one for this.

---

## What gets created

| Path | Purpose |
|---|---|
| `/data/home/work/<project>` | One git clone per repo, on its current branch |
| `/data/home/work` | Workspace root; also the OpenCode working directory |
| `/data/home/.config/instabox/openchamber-password` | OpenChamber UI password |
| `/data/home/.config/instabox/opencode.env` | Fixed OpenCode API password (`OPENCODE_PASSWORD`) |
| `/data/home/.config/instabox/providers.env` | Env-based provider keys (e.g. `TOKENROUTER_API_KEY`) |
| `/etc/systemd/system/opencode.service` | `opencode serve` on `0.0.0.0:4096` |
| `/etc/systemd/system/openchamber.service` | OpenChamber on `0.0.0.0:3000`, attached to the OpenCode server |

OpenCode 2 generates a random API password on every start unless
`OPENCODE_PASSWORD` is set. The bootstrap writes a fixed 256-bit password to
`opencode.env` and loads it into both services, so OpenChamber stays connected
across restarts. Port 4096 is published **publicly** and protected by that
password; port 3000 is published **privately** with an InstaBox token plus the
OpenChamber UI password.

---

## Step 1 — Preflight on the PC

From the `savborne` repo:

```powershell
.\scripts\instabox-preflight.ps1
```

This first pass does **not** commit anything. It finds the machine and every
repo, then stops and lists the dirty working trees. Review each one, commit and
push what you want, then run it again:

```powershell
.\scripts\instabox-preflight.ps1
```

Once the trees are clean — or if you have reviewed `git status` and want the
script to commit everything for you — use:

```powershell
.\scripts\instabox-preflight.ps1 -AutoCommit
```

`-AutoCommit` runs `git add -A` in every dirty repo and commits with
`chore: sync before instabox bootstrap`. That includes untracked files such as
render PNGs and the two InstaBox scripts themselves, so check `git status`
first.

What it does:

1. Finds the InstaBox machine. With one machine it auto-detects; with several,
   pass `-Machine <name>`.
2. Finds every git repo under `C:\Users\hp\Documents\my builds`.
3. Commits (only with `-AutoCommit`) and pushes the current branch of each.
4. Exports all 23 OpenCode sessions and every stored provider credential.
   Env-based providers (`TOKENROUTER_API_KEY`) are captured from your PC
   environment.
5. Packs a bundle, copies it to `/data/home/.instabox-bundle.tgz`, and copies
   `instabox-bootstrap.sh` to `/data/home/`.

Without `-AutoCommit`, the script stops and lists the dirty repos instead of
committing anything.

The staging directory is printed at the end. **It contains exported
credentials and full session transcripts.** Delete it after a successful run.

### Optional: run the bootstrap immediately

```powershell
.\scripts\instabox-preflight.ps1 -AutoCommit -Run
```

`-Run` streams the bootstrap through `instabox exec`. `npm install` can take
longer than the exec timeout on a slow machine; if it fails, use the SSH path
below instead.

---

## Step 2 — Bootstrap on the VM

> If the preflight listed any **private or unreachable** repos (in this
> workspace, `qestia` and `rii lashed it`), do [Step 3](#step-3--github-authentication-on-the-vm)
> **first**. The bootstrap clones before it imports anything.

```powershell
instabox ssh openode-anywhere
```

Then, inside the machine:

```bash
bash /data/home/instabox-bootstrap.sh
```

The script:

- installs Node 24 under `~/.local/node` if the template's Node is older than
  24.14 (OpenChamber requires it);
- installs OpenCode **2.x** (replacing the template's 1.19.5) and OpenChamber;
- generates a fixed OpenCode API password in
  `/data/home/.config/instabox/opencode.env`;
- clones each repo and checks out the recorded branch;
- imports provider credentials and all exported sessions (re-homed with
  `--directory`);
- writes and starts the two systemd services;
- shreds the bundle and removes the staging directory.

If a session was not tied to one of your project folders, it is imported into
`/data/home/work` so it is still available.

Check it:

```bash
systemctl status opencode openchamber --no-pager
set -a; source /data/home/.config/instabox/opencode.env; set +a
curl -fsS -u "opencode:$OPENCODE_PASSWORD" http://127.0.0.1:4096/api/info
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3000/
```

The OpenChamber HTTP code should be `200`. Its `/health` endpoint should report
`"openCodeRunning": true` and `"openCodeAuthSource": "user-env"`.

---

## Step 3 — GitHub authentication on the VM

Not all repos are public: `qestia` and `rii lashed it` are private. The
bootstrap needs `gh` authenticated **before** it clones them. Do this once:

```bash
gh auth login
```

Choose GitHub.com → HTTPS → login with a browser/device code. If `gh` is
missing:

```bash
sudo apt-get update && sudo apt-get install -y gh
```

Verify:

```bash
gh auth status
git -C /data/home/work/savborne push
```

---

## Step 4 — Publish the ports

On the PC:

```powershell
instabox port publish openode-anywhere 3000 --private
instabox port publish openode-anywhere 4096 --public
```

The `3000` command prints a URL containing `?_token=ibp_…`. That link is shown
once — the server stores only a hash. Save it in your password manager.

- `3000` is OpenChamber (phone PWA): private token + UI password.
- `4096` is the OpenCode API and native app: public URL, Basic auth with
  username `opencode` and the password from
  `/data/home/.config/instabox/opencode.env`. This is deliberate: the private
  port token and Basic auth both use the `Authorization` header, so a native
  app cannot use both at once.

If a private port is already published and the command does not reprint the
token, rotate it with
`instabox port publish openode-anywhere 3000 --private --rotate-token`.

> The 4096 endpoint is reachable by anyone who knows the URL. Its only gate is
> the 256-bit password. Rotate it by editing `opencode.env` and restarting both
> services. Unpublish 4096 if you decide the PWA is enough.

---

## Step 5 — Phone (Android)

1. Open the **3000** private link in Chrome. It sets the `__Host-instabox_port_auth`
   cookie and loads OpenChamber.
2. Log in with the password from
   `/data/home/.config/instabox/openchamber-password`.
3. Chrome menu → **Install app** / **Add to Home Screen**.
4. From then on, open the installed PWA. If it ever loses the port cookie,
   reopen the private link once.

The PWA is the recommended phone client: it is the only route that both
**wakes the paused VM** and shares the **one session database**.

### Optional: native OpenCode Mobile app

The community Android app (`OpenCode Mobile`, Play Store / APK) is a pure
client of an OpenCode server. To use it:

- Server URL: the **4096** public URL
- Username: `opencode`
- Password: from `/data/home/.config/instabox/opencode.env`
  (`OPENCODE_PASSWORD=…`)

The public port wakes the paused VM on request, just like the PWA. Because the
port is public, the password is the only gate — use a password manager and
rotate it if the URL leaks.

> OpenChamber's own native app pairs through OpenChamber's QR/Private Relay,
> which does **not** wake a paused InstaBox machine. Use the PWA on the free
> plan; the APK is only practical once the VM is already awake.

---

## Step 6 — PC clients

### OpenCode Desktop

```powershell
instabox port-forward openode-anywhere 4096
```

Keep that terminal open. Read the API password into your shell:

```powershell
$ocPass = ((instabox exec openode-anywhere -- "sed -n 's/^OPENCODE_PASSWORD=//p' /data/home/.config/instabox/opencode.env") -join "").Trim()
$env:OPENCODE_PASSWORD = $ocPass
```

Then point the desktop app's server address at:

```text
http://127.0.0.1:4096
```

Use username `opencode` and the password above if it asks. The app, the phone,
and the TUI now share the same sessions.

If the desktop app asks for a project folder rather than listing the server's
projects, open a session from the phone/PWA first, or use the TUI over SSH
(below).

### TUI on the VM (most reliable)

```powershell
instabox ssh openode-anywhere
cd /data/home/work/savborne
set -a; source /data/home/.config/instabox/opencode.env; set +a
opencode --server http://127.0.0.1:4096
```

This avoids any Windows-vs-Linux path mismatch: the TUI runs where the files
actually are.

### OpenChamber desktop (optional)

Point it at the forwarded OpenChamber port (`instabox port-forward openode-anywhere 3000`)
or use the connection link printed by `openchamber connect-url` on the VM.

---

## Step 7 — Verify sessions

On the VM:

```bash
cd /data/home/work/savborne
set -a; source /data/home/.config/instabox/opencode.env; set +a
opencode --version        # must be 2.x
opencode --server http://127.0.0.1:4096 session list -n 1000
```

You should see the 23 sessions. In OpenChamber, the project picker should list
each directory under `/data/home/work`. Sessions are grouped by project
directory.

---

## Day-to-day workflow

**Leaving the PC:**

```powershell
Get-ChildItem "C:\Users\hp\Documents\my builds" -Directory | ForEach-Object {
  if (Test-Path (Join-Path $_.FullName ".git")) { git -C $_.FullName push }
}
```

**On the VM after PC work:**

```bash
for d in /data/home/work/*/; do git -C "$d" pull --ff-only; done
```

**After phone work, on the PC:**

```powershell
Get-ChildItem "C:\Users\hp\Documents\my builds" -Directory | ForEach-Object {
  if (Test-Path (Join-Path $_.FullName ".git")) { git -C $_.FullName pull --ff-only }
}
```

Git is the sync. There is no database replication: the VM's database is the
only truth once you switch the desktop app over.

---

## Security

- The 3000 link is a bearer secret: anyone with the `?_token=` can reach the
  private port. Treat it like a password. The 4096 URL is public and is **not**
  a secret; its gate is the OpenCode password.
- OpenChamber is protected by its UI password. Rotate it by editing
  `/data/home/.config/instabox/openchamber-password` and running
  `sudo systemctl restart openchamber`.
- OpenCode's API password lives in
  `/data/home/.config/instabox/opencode.env` (`chmod 600`) and is loaded into
  both services. Rotate it by editing the file and restarting both units.
- Provider keys live in
  `/data/home/.config/instabox/providers.env` (`chmod 600`) and in OpenCode's
  credential store.
- The preflight staging directory on the PC contains credentials and
  transcripts. Delete it when done.
- `instabox port publish` exposes a port for as long as it is published. If you
  do not need the native app, run `instabox port unpublish openode-anywhere 4096`.

---

## Free-plan operations

| Event | What happens |
|---|---|
| 30 minutes idle | Machine pauses; memory and processes kept |
| Port request | Wakes the machine; waits up to ~45 s; retry on `503` |
| 8 hours continuous | Pauses; cooldown 5–20 min (longer on repeated max-run pauses) |
| `instabox stop` | **Kills the server process.** Avoid; use auto-pause |
| Snapshot | Use `instabox snapshot save work --name before-risky-run` before big changes |

After a wake, give the services a few seconds. `systemctl status opencode
openchamber` will show them running with the original start time because the
VM was frozen, not restarted.

---

## Troubleshooting

**`opencode` or `openchamber` not found in the service**
Check `Environment=PATH` in the unit; it must include the Node bin directory
and `/opt/npm/bin`. Run `sudo systemctl daemon-reload` after edits.

**OpenChamber says "OpenCode is restarting" forever**
It cannot reach `OPENCODE_HOST` or lacks the password. Check:

```bash
set -a; source /data/home/.config/instabox/opencode.env; set +a
curl -fsS -u "opencode:$OPENCODE_PASSWORD" http://127.0.0.1:4096/api/info
curl -s http://127.0.0.1:3000/health
systemctl status opencode --no-pager
```

The health JSON should say `"openCodeRunning": true` and
`"openCodeAuthSource": "user-env"`.

**OpenChamber restarts every few seconds**
It exited 0 because it daemonized. The service wrapper must pass
`--foreground` (the bootstrap does).

**CLI says "requires a password" or returns 401**
OpenCode 2 needs the fixed password:

```bash
set -a; source /data/home/.config/instabox/opencode.env; set +a
opencode --server http://127.0.0.1:4096 ...
```

For HTTP, use `-u "opencode:$OPENCODE_PASSWORD"`. The 4096 port is Basic auth
with username `opencode`.

**Phone shows 503 when opening the link**
The VM is waking. Wait and refresh; the next request should land.

**Phone shows 401**
- On the **3000** link: the private-port cookie is missing. Reopen the
  `?_token=` link once.
- On the **4096** URL: the app needs Basic auth, username `opencode` and the
  password from `opencode.env`.

**OpenChamber login fails**
Read the password directly:

```bash
cat /data/home/.config/instabox/openchamber-password
```

**Session import failed / `session import` is not a command**
The VM is running OpenCode 1.19.5 from the template. Check
`opencode --version`; it must be 2.x. Install V2:

```bash
npm install -g @opencode/cli@latest
/data/home/.local/node/bin/opencode --version
```

Then point the unit at `/data/home/.local/node/bin/opencode` and restart.

**Disk full**
`/data` is 20 GiB. Remove `.next`, `node_modules`, and build output you do not
need. A paid InstaBox plan can resize the data disk.

---

## Not included

- **Sesori** — it launches its own OpenCode sessions over ACP, so it would
  create a second session store and duplicate agent work. It also cannot wake a
  paused InstaBox machine.
- **Hand-editing code on the phone** — OpenChamber and OpenCode Mobile are
  agent cockpits with terminals, not mobile IDEs. Use the terminal (`vim`,
  `nano`) or add `code-server` later if you want a real editor.
- **Realtime two-way file sync** — intentionally git-only. Add Syncthing or
  rsync if you decide you need uncommitted work to travel automatically.
