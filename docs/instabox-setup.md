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
        └─ private port 4096 → native OpenCode Mobile app (token header)
```

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
- OpenCode CLI (`npm install -g @opencode/cli`)
- InstaBox CLI (`npm install -g instabox`) and a signed-in account (`instabox login`)

On the InstaBox account:

- An existing machine, or create one:

  ```powershell
  instabox create --name work --template agent-browser
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
| `/data/home/.config/instabox/providers.env` | Env-based provider keys (e.g. `TOKENROUTER_API_KEY`) |
| `/etc/systemd/system/opencode.service` | `opencode serve` on `0.0.0.0:4096` |
| `/etc/systemd/system/openchamber.service` | OpenChamber on `0.0.0.0:3000`, attached to the OpenCode server |

OpenCode listens on `0.0.0.0:4096` with **no password**, because the InstaBox
private port's token is the authentication for that route. OpenChamber is the
authenticated UI surface (its own password) and proxies to OpenCode over
loopback. If you would rather not use the private-token model, see
[Security](#security).

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

```powershell
instabox ssh work
```

Then, inside the machine:

```bash
bash /data/home/instabox-bootstrap.sh
```

The script:

- installs Node 24 under `~/.local/node` if the template's Node is older than
  24.14 (OpenChamber requires it);
- installs `@opencode/cli` and OpenChamber;
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
curl -fsS http://127.0.0.1:4096/api/info
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3000/
```

The OpenChamber HTTP code should be `200` or `401` (401 just means it is
asking for the UI password).

---

## Step 3 — GitHub authentication on the VM

Cloning works without credentials because all seven repos are public. Pushing
from the phone or the VM needs auth, so do this once:

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
instabox port publish work 3000 --private
instabox port publish work 4096 --private
```

Each command prints a URL containing `?_token=ibp_…`. **These links are shown
once** — the server stores only a hash. Save them in your password manager.

- `3000` is OpenChamber (phone UI).
- `4096` is the OpenCode API (native app, optional).

If a port is already published and the command does not reprint the token,
run `instabox port ls work` or rotate the token with
`instabox port publish work 3000 --private --rotate-token`.

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

- Server URL: the **4096** private link
- Custom header: `Authorization: Bearer ibp_…` (the token from the link)
- Username/password: leave blank — OpenCode has no password on this setup

If the app insists on Basic auth and the header conflicts, use the PWA
instead, or publish 4096 publicly and set an OpenCode password.

> OpenChamber's own native app pairs through OpenChamber's QR/Private Relay,
> which does **not** wake a paused InstaBox machine. Use the PWA on the free
> plan; the APK is only practical once the VM is already awake.

---

## Step 6 — PC clients

### OpenCode Desktop

```powershell
instabox port-forward work 4096
```

Keep that terminal open, then point the desktop app's server address at:

```text
http://127.0.0.1:4096
```

No password. The app, the phone, and the TUI now share the same sessions.

If the desktop app asks for a project folder rather than listing the server's
projects, open a session from the phone/PWA first, or use the TUI over SSH
(below).

### TUI on the VM (most reliable)

```powershell
instabox ssh work
cd /data/home/work/savborne
opencode
```

This avoids any Windows-vs-Linux path mismatch: the TUI runs where the files
actually are.

### OpenChamber desktop (optional)

Point it at the forwarded OpenChamber port (`instabox port-forward work 3000`)
or use the connection link printed by `openchamber connect-url` on the VM.

---

## Step 7 — Verify sessions

On the VM:

```bash
opencode session list --max-count 1000
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

- The 3000 and 4096 links are bearer secrets. Anyone with a link can reach the
  port. Treat them like passwords.
- OpenChamber is protected by its UI password. Rotate it by editing
  `/data/home/.config/instabox/openchamber-password` and running
  `sudo systemctl restart openchamber`.
- OpenCode on 4096 has no password. Its protection is the InstaBox private
  token. If you want a password too, stop publishing 4096 and use only the
  PWA, or put a reverse proxy in front.
- Provider keys live in
  `/data/home/.config/instabox/providers.env` (`chmod 600`) and in OpenCode's
  credential store.
- The preflight staging directory on the PC contains credentials and
  transcripts. Delete it when done.
- `instabox port publish` exposes a port for as long as it is published. Use
  `instabox port unpublish work 4096` (or `3000`) when you no longer need one.

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
It cannot reach `OPENCODE_HOST`. Check:

```bash
curl -fsS http://127.0.0.1:4096/api/info
systemctl status opencode --no-pager
```

**Phone shows 503 when opening the link**
The VM is waking. Wait and refresh; the next request should land.

**Phone shows 401**
The private-port cookie is missing. Reopen the `?_token=` link once.

**OpenChamber login fails**
Read the password directly:

```bash
cat /data/home/.config/instabox/openchamber-password
```

**Session import failed**
The target directory must exist before import. Re-run the clone step, then the
import loop in `instabox-bootstrap.sh`.

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
