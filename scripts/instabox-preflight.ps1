<#
.SYNOPSIS
  Prepares every git project in "my builds" for the InstaBox VM and stages the
  bundle that scripts/instabox-bootstrap.sh consumes on the machine.

.DESCRIPTION
  Run this on the Windows PC, from the savborne repo (or pass -Root).

  What it does:
    1. Finds the InstaBox machine (or uses -Machine).
    2. Enumerates git repos under -Root.
    3. Optionally commits and pushes dirty working trees (-AutoCommit).
    4. Exports OpenCode sessions and provider credentials.
    5. Writes a manifest, tars the bundle, and copies it to the VM.
    6. Optionally runs the bootstrap and publishes the private ports.

  JSON is handled by Node because ConvertTo-Json/ConvertFrom-Json are broken
  in this PowerShell installation (System.Web load failure).

.EXAMPLE
  .\scripts\instabox-preflight.ps1 -AutoCommit

.EXAMPLE
  .\scripts\instabox-preflight.ps1 -AutoCommit -Run -PublishPorts
#>
[CmdletBinding()]
param(
  [string]$Root = "C:\Users\hp\Documents\my builds",
  [string]$Machine = "",
  [switch]$AutoCommit,
  [string]$CommitMessage = "chore: sync before instabox bootstrap",
  [switch]$SkipSessions,
  [switch]$SkipAuth,
  [switch]$Run,
  [switch]$PublishPorts,
  [string]$WorkspaceRoot = "/data/home/work"
)

# Native tools write warnings (e.g. git's LF/CRLF notice) to stderr. With
# "Stop", PowerShell 5.1 turns those into terminating errors. Use "Continue"
# globally and check $LASTEXITCODE after every native call that matters.
$ErrorActionPreference = "Continue"
$repoRoot = Split-Path -Parent $PSScriptRoot

function Fail([string]$Message) {
  Write-Host "ERROR: $Message" -ForegroundColor Red
  exit 1
}

function Require-Command([string]$Name, [string]$Hint) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    Fail "Missing '$Name'. $Hint"
  }
}

function Write-Utf8NoBom([string]$Path, [string]$Text) {
  $dir = Split-Path -Parent $Path
  if ($dir -and -not (Test-Path $dir)) {
    New-Item -ItemType Directory -Force -Path $dir -ErrorAction Stop | Out-Null
  }
  $enc = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($Path, $Text, $enc)
}

function Normalize-Path([string]$Path) {
  if (-not $Path) { return "" }
  $p = $Path -replace '\\', '/'
  $p = $p -replace '/+$', ''
  return $p.ToLowerInvariant()
}

$script:nodeHelperCounter = 0

function Invoke-NodeScript([string]$Script, [string[]]$Arguments) {
  # PowerShell 5.1 strips double quotes from a multi-line string passed to a
  # native command, so write the helper to a file and run it.
  $script:nodeHelperCounter++
  $helper = Join-Path $tmp ("node-helper-{0}.js" -f $script:nodeHelperCounter)
  Write-Utf8NoBom $helper $Script
  $output = & node $helper @Arguments 2>&1
  if ($LASTEXITCODE -ne 0) {
    Fail "Node helper failed: $output"
  }
  return @($output)
}

# ---------------------------------------------------------------- prerequisites
Write-Host "==> Checking prerequisites" -ForegroundColor Cyan
Require-Command "git" "Install Git for Windows."
Require-Command "node" "Install Node.js 20 or newer."
Require-Command "opencode" "Install the OpenCode CLI (@opencode/cli)."
Require-Command "instabox" "Run: npm install -g instabox  (then: instabox login)"
Require-Command "tar" "tar ships with Windows 10+."

if (-not (Test-Path $Root)) { Fail "Root not found: $Root" }

$bootstrap = Join-Path $repoRoot "scripts\instabox-bootstrap.sh"
if (-not (Test-Path $bootstrap)) { Fail "Missing bootstrap script: $bootstrap" }

$tmp = Join-Path $env:TEMP ("instabox-" + [guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Force -Path $tmp -ErrorAction Stop | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $tmp "sessions") -ErrorAction Stop | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $tmp "auth") -ErrorAction Stop | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $tmp "env") -ErrorAction Stop | Out-Null

# ---------------------------------------------------------------- machine
Write-Host "==> Finding InstaBox machine" -ForegroundColor Cyan
$machinesJson = (& instabox ls --json 2>$null) -join "`n"
if (-not $machinesJson) { Fail "instabox ls returned nothing. Run: instabox login" }
$machinesPath = Join-Path $tmp "machines.json"
Write-Utf8NoBom $machinesPath $machinesJson

$jsMachines = @'
const fs = require("fs");
let x;
try { x = JSON.parse(fs.readFileSync(process.argv[2], "utf8").replace(/^\uFEFF/, "")); }
catch (e) { console.error("invalid JSON from instabox ls"); process.exit(2); }
const a = Array.isArray(x) ? x : (x.machines || x.items || x.data || (x.name || x.id ? [x] : []));
const list = Array.isArray(a) ? a : Object.values(a);
for (const m of list) console.log([m.name || m.id || "", m.status || m.state || ""].join("\t"));
'@
$machineRows = Invoke-NodeScript $jsMachines @($machinesPath) | Where-Object { $_ -ne "" }

$machineNames = @()
foreach ($row in $machineRows) { $machineNames += ($row -split "`t")[0] }

if ($Machine) {
  if ($machineNames -notcontains $Machine) {
    Fail "Machine '$Machine' not found. Available: $($machineNames -join ', ')"
  }
} else {
  if ($machineNames.Count -eq 0) {
    Fail "No InstaBox machine found. Create one with: instabox create --name work --template agent-browser"
  }
  if ($machineNames.Count -gt 1) {
    Fail "Several machines exist. Re-run with -Machine <name>. Available: $($machineNames -join ', ')"
  }
  $Machine = $machineNames[0]
}
Write-Host "    using machine: $Machine" -ForegroundColor Green

# ---------------------------------------------------------------- projects
Write-Host "==> Scanning projects under $Root" -ForegroundColor Cyan
$projects = @()
$dirtyProjects = @()

foreach ($dir in (Get-ChildItem $Root -Directory -ErrorAction SilentlyContinue)) {
  if (-not (Test-Path (Join-Path $dir.FullName ".git"))) { continue }

  $remote = (& git -C $dir.FullName remote get-url origin 2>$null) -join ""
  if (-not $remote) {
    Write-Warning "Skipping '$($dir.Name)': no origin remote"
    continue
  }

  $branch = (& git -C $dir.FullName branch --show-current 2>$null) -join ""
  if (-not $branch) { Fail "'$($dir.Name)' has a detached HEAD. Check out a branch first." }

  $status = @(& git -C $dir.FullName status --porcelain 2>$null | Where-Object { $_ -ne "" })
  $dirty = $status.Count

  if ($dirty -gt 0) {
    if ($AutoCommit) {
      Write-Host "    committing $dirty change(s) in $($dir.Name)" -ForegroundColor Yellow
      & git -C $dir.FullName add -A 2>&1 | Out-Null
      & git -C $dir.FullName commit -m $CommitMessage 2>&1 | Out-Null
      if ($LASTEXITCODE -ne 0) {
        Write-Host "    nothing to commit in $($dir.Name) (racing state), continuing" -ForegroundColor Yellow
      }
    } else {
      $dirtyProjects += "$($dir.Name) ($dirty entries)"
    }
  }

  $leaf = ($remote -split '[\\/]')[-1]
  $slug = ($leaf -replace '\.git$', '') -replace '[^A-Za-z0-9._-]', '-'
  if (-not $slug) { $slug = $dir.Name -replace '[^A-Za-z0-9._-]', '-' }

  $projects += [pscustomobject]@{
    LocalName = $dir.Name
    VmDir     = $slug
    Remote    = $remote
    Branch    = $branch
    Path      = $dir.FullName
  }
}

if ($dirtyProjects.Count -gt 0) {
  Write-Host ""
  Write-Host "Dirty working trees:" -ForegroundColor Yellow
  $dirtyProjects | ForEach-Object { Write-Host "  - $_" }
  Write-Host ""
  Fail "Re-run with -AutoCommit, or commit and push these yourself first."
}

if ($projects.Count -eq 0) { Fail "No git projects found under $Root" }

Write-Host "==> Pushing project branches" -ForegroundColor Cyan
foreach ($p in $projects) {
  Write-Host "    $($p.LocalName) -> origin/$($p.Branch)"
  & git -C $p.Path push --quiet -u origin $p.Branch 2>&1 | Out-Null
  if ($LASTEXITCODE -ne 0) { Fail "git push failed for $($p.LocalName)" }
}

$gitName = ((& git config --global user.name 2>$null) -join "").Trim()
$gitEmail = ((& git config --global user.email 2>$null) -join "").Trim()
if (-not $gitName) { $gitName = "instabox" }
if (-not $gitEmail) { $gitEmail = "instabox@localhost" }

# ---------------------------------------------------------------- sessions
$projectRows = @()
foreach ($p in $projects) {
  $projectRows += "$($p.LocalName)`t$($p.VmDir)`t$($p.Remote)`t$($p.Branch)"
}
$projectsTsv = Join-Path $tmp "projects.tsv"
Write-Utf8NoBom $projectsTsv ($projectRows -join "`n")

$sessionRows = @()
if (-not $SkipSessions) {
  Write-Host "==> Exporting OpenCode sessions" -ForegroundColor Cyan
  $sessionsJson = (& opencode session list --max-count 1000 --format json 2>$null) -join "`n"
  $sessionsPath = Join-Path $tmp "sessions.json"
  Write-Utf8NoBom $sessionsPath $sessionsJson

  $jsSessions = @'
const fs = require("fs");
const x = JSON.parse(fs.readFileSync(process.argv[2], "utf8").replace(/^\uFEFF/, ""));
const a = Array.isArray(x) ? x : (x.sessions || x.items || x.data || []);
const list = Array.isArray(a) ? a : Object.values(a);
for (const s of list) console.log([s.id || "", s.directory || s.location || "", String(s.title || "").replace(/[\t\r\n]/g, " ")].join("\t"));
'@
  $sessionList = Invoke-NodeScript $jsSessions @($sessionsPath) | Where-Object { $_ -ne "" }

  $byPath = @{}
  foreach ($p in $projects) { $byPath[(Normalize-Path $p.Path)] = $p.VmDir }

  foreach ($line in $sessionList) {
    $parts = $line -split "`t", 3
    $sid = $parts[0]
    $sdir = $parts[1]
    $title = if ($parts.Count -ge 3) { $parts[2] } else { "" }
    if (-not $sid) { continue }

    $vmDir = $byPath[(Normalize-Path $sdir)]
    if (-not $vmDir) { $vmDir = "." }

    $raw = (& opencode session export $sid 2>$null) -join "`n"
    if (-not $raw) {
      Write-Warning "Could not export session $sid"
      continue
    }
    $file = "sessions/$sid.json"
    Write-Utf8NoBom (Join-Path $tmp $file) $raw
    $sessionRows += "$sid`t$sdir`t$vmDir`t$file`t$title"
    Write-Host "    $sid -> $vmDir" -ForegroundColor DarkGray
  }
}
$sessionsTsv = Join-Path $tmp "sessions.tsv"
Write-Utf8NoBom $sessionsTsv ($sessionRows -join "`n")
Write-Host "    exported $($sessionRows.Count) session(s)" -ForegroundColor Green

# ---------------------------------------------------------------- auth
$envRows = @()
if (-not $SkipAuth) {
  Write-Host "==> Exporting provider credentials" -ForegroundColor Cyan
  $authJson = (& opencode auth list --format json 2>$null) -join "`n"
  $authPath = Join-Path $tmp "auth.json"
  Write-Utf8NoBom $authPath $authJson

  $jsAuth = @'
const fs = require("fs");
const x = JSON.parse(fs.readFileSync(process.argv[2], "utf8").replace(/^\uFEFF/, ""));
const a = Array.isArray(x) ? x : (x.providers || x.items || x.data || []);
const list = Array.isArray(a) ? a : Object.values(a);
for (const p of list) {
  const c = p.connections || [];
  const env = c.filter(v => v.type === "env").map(v => v.name).filter(Boolean);
  const stored = c.some(v => v.type !== "env");
  console.log([p.id || p.provider || "", stored ? "stored" : "env", env.join(",")].join("\t"));
}
'@
  $authList = Invoke-NodeScript $jsAuth @($authPath) | Where-Object { $_ -ne "" }

  foreach ($line in $authList) {
    $parts = $line -split "`t", 3
    $provider = $parts[0]
    $kind = $parts[1]
    $envNames = if ($parts.Count -ge 3) { $parts[2] } else { "" }
    if (-not $provider) { continue }

    if ($kind -eq "stored") {
      $raw = (& opencode auth export $provider 2>$null) -join "`n"
      if ($raw) {
        Write-Utf8NoBom (Join-Path $tmp "auth/$provider.json") $raw
        Write-Host "    stored credential: $provider" -ForegroundColor DarkGray
      } else {
        Write-Warning "auth export produced nothing for $provider"
      }
    }

    if ($envNames) {
      foreach ($name in ($envNames -split ',')) {
        if (-not $name) { continue }
        $value = [Environment]::GetEnvironmentVariable($name, "Process")
        if (-not $value) { $value = [Environment]::GetEnvironmentVariable($name, "User") }
        if (-not $value) { $value = [Environment]::GetEnvironmentVariable($name, "Machine") }
        if (-not $value) {
          Write-Warning "Environment provider '$provider' needs $name, but it is not set on this PC."
          continue
        }
        $envRows += "$name`t$value"
        Write-Host "    environment credential: $name" -ForegroundColor DarkGray
      }
    }
  }

  if ($envRows.Count -gt 0) {
    $envLines = @()
    foreach ($row in $envRows) {
      $pair = $row -split "`t", 2
      $escaped = $pair[1].Replace('\', '\\').Replace('"', '\"')
      $envLines += ('{0}="{1}"' -f $pair[0], $escaped)
    }
    Write-Utf8NoBom (Join-Path $tmp "env/providers.env") (($envLines -join "`n") + "`n")
  }
}
$envTsv = Join-Path $tmp "env.tsv"
$envNamesOnly = @()
foreach ($row in $envRows) { $envNamesOnly += (($row -split "`t")[0]) }
Write-Utf8NoBom $envTsv ($envNamesOnly -join "`n")

# ---------------------------------------------------------------- manifest
Write-Host "==> Writing manifest" -ForegroundColor Cyan
$manifestPath = Join-Path $tmp "manifest.json"
$jsManifest = @'
const fs = require("fs");
const read = p => fs.existsSync(p) ? fs.readFileSync(p, "utf8").split(/\r?\n/).filter(Boolean) : [];
const projects = read(process.argv[2]).map(l => {
  const [localName, vmDir, remote, branch] = l.split("\t");
  return { localName, vmDir, remote, branch };
});
const sessions = read(process.argv[3]).map(l => {
  const [id, localDirectory, vmDirectory, file, title] = l.split("\t");
  return { id, localDirectory, vmDirectory, file, title };
});
const env = read(process.argv[4]).map(l => l.split("\t")[0]).filter(Boolean);
const manifest = {
  generatedAt: new Date().toISOString(),
  machine: process.argv[5],
  workspaceRoot: process.argv[9],
  git: { name: process.argv[6], email: process.argv[7] },
  projects,
  sessions,
  env
};
fs.writeFileSync(process.argv[8], JSON.stringify(manifest, null, 2));
'@
Invoke-NodeScript $jsManifest @($projectsTsv, $sessionsTsv, $envTsv, $Machine, $gitName, $gitEmail, $manifestPath, $WorkspaceRoot) | Out-Null

# ---------------------------------------------------------------- bundle and copy
Write-Host "==> Packing and copying bundle" -ForegroundColor Cyan
$bundle = Join-Path $tmp "bundle.tgz"
& tar -czf $bundle -C $tmp manifest.json sessions auth env 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) { Fail "tar failed while creating $bundle" }

& instabox cp $bundle "${Machine}:/data/home/.instabox-bundle.tgz" 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) { Fail "instabox cp failed for the bundle" }

# Guarantee LF endings: a CRLF bash script fails on the VM with `\r` errors.
$bootstrapLf = Join-Path $tmp "instabox-bootstrap.sh"
$bootstrapText = [System.IO.File]::ReadAllText($bootstrap)
$bootstrapText = $bootstrapText -replace "`r`n", "`n"
Write-Utf8NoBom $bootstrapLf $bootstrapText

& instabox cp $bootstrapLf "${Machine}:/data/home/instabox-bootstrap.sh" 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) { Fail "instabox cp failed for the bootstrap script" }

Write-Host "    bundle copied" -ForegroundColor Green

if ($Run) {
  Write-Host "==> Running bootstrap on $Machine" -ForegroundColor Cyan
  & instabox exec --stream $Machine -- bash /data/home/instabox-bootstrap.sh 2>&1
  if ($LASTEXITCODE -ne 0) { Fail "bootstrap failed (exit $LASTEXITCODE)" }
} else {
  Write-Host ""
  Write-Host "Next: run the bootstrap on the machine" -ForegroundColor Yellow
  Write-Host "  instabox ssh $Machine"
  Write-Host "  bash /data/home/instabox-bootstrap.sh"
}

if ($PublishPorts) {
  Write-Host "==> Publishing private ports" -ForegroundColor Cyan
  $url3000 = (& instabox port publish $Machine 3000 --private 2>&1) -join "`n"
  $url4096 = (& instabox port publish $Machine 4096 --private 2>&1) -join "`n"
  Write-Host ""
  Write-Host "OpenChamber (phone):" -ForegroundColor Green
  Write-Host $url3000
  Write-Host ""
  Write-Host "OpenCode API (native app):" -ForegroundColor Green
  Write-Host $url4096
  Write-Host ""
  Write-Host "Private links are shown once. Store them somewhere safe." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Done. Staging directory: $tmp" -ForegroundColor Green
Write-Host "If everything is healthy you can delete it; it contains exported credentials and sessions." -ForegroundColor Yellow
