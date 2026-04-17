#Requires -Version 5.1
<#
.SYNOPSIS
    WebVNC - Self-contained Windows Installer

.DESCRIPTION
    Downloads the WebVNC repository from GitHub, installs Node.js (if needed),
    builds the project, configures it interactively, and creates a desktop launcher.
    No pre-installed tools are required beyond this script / exe.

.NOTES
    Run directly:
        Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
        .\installer\webvnc-setup.ps1

    Or compile to a standalone exe first (see installer\build-exe.ps1).
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
$GITHUB_OWNER  = 'elias4044'
$GITHUB_REPO   = 'webvnc'
$GITHUB_BRANCH = 'main'
$GITHUB_ZIP    = "https://github.com/$GITHUB_OWNER/$GITHUB_REPO/archive/refs/heads/$GITHUB_BRANCH.zip"

$INSTALL_DIR_DEFAULT = Join-Path $env:LOCALAPPDATA 'WebVNC'

# ---------------------------------------------------------------------------
# UI helpers
# ---------------------------------------------------------------------------
function Write-Banner {
    Write-Host ''
    Write-Host '  +------------------------------------------+' -ForegroundColor Cyan
    Write-Host '  |           WebVNC  Installer              |' -ForegroundColor Cyan
    Write-Host '  |  Browser-based VNC client for Windows    |' -ForegroundColor Cyan
    Write-Host '  +------------------------------------------+' -ForegroundColor Cyan
    Write-Host ''
}

function Write-Header {
    param([string]$Text)
    Write-Host ''
    Write-Host "  $Text" -ForegroundColor Cyan
    Write-Host ("  " + ('-' * $Text.Length)) -ForegroundColor DarkCyan
    Write-Host ''
}

function Write-Step  { param([string]$T) Write-Host "    $T" -ForegroundColor White }
function Write-OK    { param([string]$T) Write-Host "  [OK]    $T" -ForegroundColor Green }
function Write-Warn  { param([string]$T) Write-Host "  [WARN]  $T" -ForegroundColor Yellow }
function Write-Info  { param([string]$T) Write-Host "  [INFO]  $T" -ForegroundColor Gray }
function Write-Fail  { param([string]$T) Write-Host "  [ERROR] $T" -ForegroundColor Red }

function Confirm-Step {
    param([string]$Question, [bool]$Default = $true)
    $hint = if ($Default) { '[Y/n]' } else { '[y/N]' }
    Write-Host "  $Question $hint " -ForegroundColor White -NoNewline
    $a = (Read-Host).Trim().ToLower()
    if ($a -eq '') { return $Default }
    return ($a -eq 'y')
}

function Read-Value {
    param([string]$Label, [string]$Default)
    Write-Host "  ${Label} [$Default]: " -ForegroundColor White -NoNewline
    $a = (Read-Host).Trim()
    if ($a -eq '') { return $Default }
    return $a
}

function Test-Cmd {
    param([string]$Name)
    return ($null -ne (Get-Command $Name -ErrorAction SilentlyContinue))
}

function Refresh-Path {
    $machine = [System.Environment]::GetEnvironmentVariable('PATH', 'Machine')
    $user    = [System.Environment]::GetEnvironmentVariable('PATH', 'User')
    $env:PATH = "$machine;$user"
}

function Exit-WithPause {
    param([int]$Code = 1)
    Write-Host ''
    Read-Host '  Press Enter to exit'
    exit $Code
}

# ---------------------------------------------------------------------------
# Prerequisite: winget
# ---------------------------------------------------------------------------
function Assert-Winget {
    if (-not (Test-Cmd 'winget')) {
        Write-Fail 'winget (App Installer) is not available on this machine.'
        Write-Fail 'Update Windows or install App Installer from the Microsoft Store,'
        Write-Fail 'then re-run this installer.'
        Exit-WithPause
    }
}

# ---------------------------------------------------------------------------
# Install Node.js via winget
# ---------------------------------------------------------------------------
function Install-NodeJs {
    Write-Header 'Step 1 - Node.js'

    if (Test-Cmd 'node') {
        $raw   = (node --version 2>$null)
        $major = [int](($raw.TrimStart('v') -split '\.')[0])
        if ($major -ge 20) {
            Write-OK "Node.js $raw is already installed."
            return
        }
        Write-Warn "Node.js $raw is installed but version 20+ is required. Upgrading..."
    }

    Assert-Winget

    Write-Step 'Installing Node.js 20 LTS via winget (this may take a minute)...'
    $result = Start-Process 'winget' `
        -ArgumentList 'install','--id','OpenJS.NodeJS.LTS','--accept-source-agreements','--accept-package-agreements','--silent' `
        -Wait -PassThru -NoNewWindow
    if ($result.ExitCode -ne 0) {
        Write-Fail "winget exited with code $($result.ExitCode)."
        Write-Fail 'Install Node.js 20+ manually from https://nodejs.org then re-run.'
        Exit-WithPause
    }

    Refresh-Path

    if (-not (Test-Cmd 'node')) {
        Write-Warn 'node is not yet on PATH. Searching for it...'
        $found = Get-ChildItem 'C:\Program Files\nodejs\node.exe' -ErrorAction SilentlyContinue
        if ($found) {
            $env:PATH = "C:\Program Files\nodejs;$env:PATH"
            Write-OK 'Found Node.js at C:\Program Files\nodejs'
        } else {
            Write-Fail 'Could not find node.exe after install. Please restart this installer.'
            Exit-WithPause
        }
    }

    Write-OK "Node.js $(node --version) installed."
}

# ---------------------------------------------------------------------------
# Download WebVNC from GitHub
# ---------------------------------------------------------------------------
function Get-WebVNC {
    param([string]$InstallDir)

    Write-Header 'Step 2 - Download WebVNC'

    # If we are already running inside the repo, skip the download.
    $localPkg = ''
    $scriptDir = if ($MyInvocation.ScriptName -and ($MyInvocation.ScriptName.Trim() -ne '')) {
        Split-Path -Parent $MyInvocation.ScriptName
    } else { '' }
    if ($scriptDir -ne '') {
        $localMarker = Join-Path $scriptDir '..' | Resolve-Path -ErrorAction SilentlyContinue
        if ($localMarker) { $localPkg = Join-Path $localMarker 'package.json' }
    }

    if ($localPkg -ne '' -and (Test-Path $localPkg) -and ((Get-Content $localPkg -Raw) -match '"name"\s*:\s*"webvnc"')) {
        Write-OK 'Already running from inside the WebVNC repository. Skipping download.'
        return (Split-Path -Parent $localPkg)
    }

    if (Test-Path $InstallDir) {
        if (-not (Confirm-Step "Directory '$InstallDir' already exists. Re-download and overwrite?" $false)) {
            Write-OK 'Using existing installation directory.'
            return $InstallDir
        }
        Write-Step "Removing existing directory: $InstallDir"
        Remove-Item $InstallDir -Recurse -Force
    }


    # Ensure $env:TEMP is set and not empty
    $tempDir = $env:TEMP
    if ([string]::IsNullOrWhiteSpace($tempDir)) {
        if ($env:TMP -and -not [string]::IsNullOrWhiteSpace($env:TMP)) {
            $tempDir = $env:TMP
        } elseif ($env:LOCALAPPDATA -and -not [string]::IsNullOrWhiteSpace($env:LOCALAPPDATA)) {
            $tempDir = Join-Path $env:LOCALAPPDATA 'Temp'
        } else {
            Write-Fail 'TEMP directory environment variable is not set. Please set TEMP or TMP and re-run.'
            Exit-WithPause
        }
    }
    $zipPath = Join-Path $tempDir 'webvnc-download.zip'
    $zipDir  = Join-Path $tempDir 'webvnc-extract'

    Write-Step "Downloading from $GITHUB_ZIP ..."
    try {
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        Invoke-WebRequest -Uri $GITHUB_ZIP -OutFile $zipPath -UseBasicParsing
    } catch {
        Write-Fail "Download failed: $_"
        Write-Fail "Check your internet connection or download manually from:"
        Write-Fail "  https://github.com/$GITHUB_OWNER/$GITHUB_REPO"
        Exit-WithPause
    }

    Write-Step 'Extracting archive...'
    if (Test-Path $zipDir) { Remove-Item $zipDir -Recurse -Force }
    Expand-Archive -Path $zipPath -DestinationPath $zipDir -Force
    Remove-Item $zipPath -Force

    # GitHub archives extract to a subdirectory named <repo>-<branch>
    $extracted = Get-ChildItem $zipDir -Directory | Select-Object -First 1
    if (-not $extracted) {
        Write-Fail 'Archive extraction produced no subdirectory. Archive may be corrupt.'
        Exit-WithPause
    }

    Write-Step "Installing to $InstallDir ..."
    $parentDir = Split-Path $InstallDir
    if ($parentDir -and -not (Test-Path $parentDir)) {
        New-Item -ItemType Directory -Path $parentDir -Force | Out-Null
    }
    Move-Item $extracted.FullName $InstallDir
    Remove-Item $zipDir -Recurse -Force

    Write-OK "WebVNC downloaded to $InstallDir"
    return $InstallDir
}

# ---------------------------------------------------------------------------
# npm install + build
# ---------------------------------------------------------------------------
function Build-WebVNC {
    param([string]$Root)

    Write-Header 'Step 3 - Install dependencies'
    Write-Step 'Running npm install...'

    $npm = 'npm'
    if (-not (Test-Cmd 'npm')) {
        $candidate = Join-Path 'C:\Program Files\nodejs' 'npm.cmd'
        if (Test-Path $candidate) { $npm = $candidate }
        else { Write-Fail 'npm not found. Ensure Node.js is installed correctly.'; Exit-WithPause }
    }

    Push-Location $Root
    try {
        # Use Continue so that npm's stderr warnings (written via Write-Error in npm.ps1)
        # do not trigger a terminating error under $ErrorActionPreference = 'Stop'.
        # Failures are detected via $LASTEXITCODE instead.
        $local:ErrorActionPreference = 'Continue'
        & $npm install --prefer-offline 2>&1 | ForEach-Object { Write-Host "    $_" -ForegroundColor DarkGray }
        if ($LASTEXITCODE -ne 0) { throw "npm install exited with code $LASTEXITCODE" }
        Write-OK 'Dependencies installed.'

        Write-Header 'Step 4 - Build'
        Write-Step 'Running npm run build...'
        & $npm run build 2>&1 | ForEach-Object { Write-Host "    $_" -ForegroundColor DarkGray }
        if ($LASTEXITCODE -ne 0) { throw "npm run build exited with code $LASTEXITCODE" }
        Write-OK 'Build complete.'
    } finally {
        Pop-Location
    }
}

# ---------------------------------------------------------------------------
# Write .env
# ---------------------------------------------------------------------------
function Write-EnvFile {
    param([string]$Root)

    Write-Header 'Step 5 - Configuration'

    $envPath        = Join-Path $Root '.env'
    $envExamplePath = Join-Path $Root '.env.example'

    if (Test-Path $envPath) {
        if (-not (Confirm-Step '.env already exists. Overwrite with new settings?' $false)) {
            Write-OK 'Keeping existing .env.'
            # Read existing values so the summary is accurate
            $cfg = @{ httpPort = '3000'; wsPort = '6080'; vncHost = 'localhost'; vncPort = '5900' }
            Get-Content $envPath | ForEach-Object {
                if ($_ -match '^PORT=(.+)')             { $cfg.httpPort = $Matches[1] }
                if ($_ -match '^VNC_DEFAULT_PORT=(.+)') { $cfg.wsPort   = $Matches[1] }
                if ($_ -match '^VNC_DEFAULT_HOST=(.+)') { $cfg.vncHost  = $Matches[1] }
                if ($_ -match '^VNC_TARGET_PORT=(.+)')  { $cfg.vncPort  = $Matches[1] }
            }
            return $cfg
        }
    }

    Write-Host ''
    Write-Host '  Enter your VNC server connection details.' -ForegroundColor Gray
    Write-Host '  Press Enter to accept the default shown in [brackets].' -ForegroundColor Gray
    Write-Host ''

    $vncHost    = Read-Value 'VNC server hostname or IP                ' 'localhost'
    $vncPort    = Read-Value 'VNC server TCP port  (UltraVNC default)  ' '5900'
    $wsPort     = Read-Value 'WebSocket bridge port (browser uses this)' '6080'
    $useBuiltIn = Confirm-Step 'Enable built-in WebSocket-to-TCP bridge?' $true
    $httpPort   = Read-Value 'WebVNC HTTP server port                  ' '3000'
    $nodeEnv    = Read-Value 'Environment                              ' 'production'

    if (-not (Test-Path $envExamplePath)) {
        Write-Warn '.env.example not found - writing a minimal .env directly.'
        $minimal  = "NODE_ENV=$nodeEnv`r`n"
        $minimal += "HOST=0.0.0.0`r`nPORT=$httpPort`r`nLOG_LEVEL=info`r`n"
        $minimal += "CORS_ORIGIN=*`r`nRATE_LIMIT_MAX=100`r`nRATE_LIMIT_WINDOW_MS=60000`r`n"
        $minimal += "VNC_DEFAULT_HOST=$vncHost`r`nVNC_DEFAULT_PORT=$wsPort`r`nVNC_DEFAULT_PATH=/`r`n"
        $minimal += "VNC_DEFAULT_ENCRYPT=false`r`n"
        $minimal += "WEBSOCKIFY_ENABLED=$(if ($useBuiltIn) { 'true' } else { 'false' })`r`n"
        $minimal += "WEBSOCKIFY_PORT=$wsPort`r`nWEBSOCKIFY_HOST=0.0.0.0`r`nTRUST_PROXY=false`r`n"
        $minimal += "VNC_TARGET_HOST=$vncHost`r`nVNC_TARGET_PORT=$vncPort`r`n"
        [System.IO.File]::WriteAllText($envPath, $minimal, [System.Text.UTF8Encoding]::new($false))
    } else {
        $content = Get-Content $envExamplePath -Raw
        $wsEnabledVal = if ($useBuiltIn) { 'true' } else { 'false' }
        $content = $content -replace '(?m)^NODE_ENV=\S*',       "NODE_ENV=$nodeEnv"
        $content = $content -replace '(?m)^PORT=\S*',           "PORT=$httpPort"
        $content = $content -replace '(?m)^LOG_LEVEL=\S*',      'LOG_LEVEL=info'
        $content = $content -replace '(?m)^VNC_DEFAULT_HOST=\S*',"VNC_DEFAULT_HOST=$vncHost"
        $content = $content -replace '(?m)^VNC_DEFAULT_PORT=\S*',"VNC_DEFAULT_PORT=$wsPort"
        $content = $content -replace '(?m)^WEBSOCKIFY_ENABLED=\S*',"WEBSOCKIFY_ENABLED=$wsEnabledVal"
        $content = $content -replace '(?m)^WEBSOCKIFY_PORT=\S*', "WEBSOCKIFY_PORT=$wsPort"
        $content += "`r`n# VNC target (built-in bridge forwards to this)`r`nVNC_TARGET_HOST=$vncHost`r`nVNC_TARGET_PORT=$vncPort`r`n"
        [System.IO.File]::WriteAllText($envPath, $content, [System.Text.UTF8Encoding]::new($false))
    }

    Write-OK ".env written to $envPath"
    return @{ httpPort = $httpPort; wsPort = $wsPort; vncHost = $vncHost; vncPort = $vncPort }
}

# ---------------------------------------------------------------------------
# Optional: websockify
# ---------------------------------------------------------------------------
function Install-Websockify {
    Write-Header 'Step 6 - Standalone websockify (optional)'
    Write-Host ''
    Write-Host '  The built-in bridge handles WebSocket-to-TCP proxying automatically.' -ForegroundColor Gray
    Write-Host '  Only install websockify if you want a separately managed bridge process.' -ForegroundColor Gray
    Write-Host ''

    if (-not (Confirm-Step 'Install standalone websockify?' $false)) {
        Write-OK 'Skipped.'
        return $false
    }

    $pythonOk = $false
    if (Test-Cmd 'python') {
        $ver = (python --version 2>&1)
        if ($ver -match 'Python 3') {
            Write-OK "Python already installed: $ver"
            $pythonOk = $true
        }
    }

    if (-not $pythonOk) {
        Assert-Winget
        Write-Step 'Installing Python 3.12 via winget...'
        $r = Start-Process 'winget' `
            -ArgumentList 'install','--id','Python.Python.3.12','--accept-source-agreements','--accept-package-agreements','--silent' `
            -Wait -PassThru -NoNewWindow
        Refresh-Path
        if ($r.ExitCode -eq 0 -and (Test-Cmd 'python')) {
            Write-OK 'Python 3 installed.'
            $pythonOk = $true
        } else {
            Write-Warn 'Python install failed. Skipping websockify.'
            return $false
        }
    }

    Write-Step 'Installing websockify via pip...'
    python -m pip install --upgrade websockify --quiet 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) { Write-OK 'websockify installed.' } else { Write-Warn 'pip install failed. Run: pip install websockify' }
    return $true
}

# ---------------------------------------------------------------------------
# Optional: open UltraVNC download
# ---------------------------------------------------------------------------
function Prompt-UltraVNC {
    param([string]$VncPort)

    Write-Header 'Step 7 - VNC server'
    Write-Host '  WebVNC is a client - it needs a VNC server to connect to.' -ForegroundColor Gray
    Write-Host '  UltraVNC is the recommended free VNC server for Windows.' -ForegroundColor Gray
    Write-Host ''

    if (Confirm-Step 'Open the UltraVNC download page in your browser?' $true) {
        Start-Process 'https://uvnc.com/downloads/ultravnc.html'
        Write-Host ''
        Write-Host '  Quick setup guide for UltraVNC:' -ForegroundColor White
        Write-Host "    1. Run the installer. Enable 'Mirror Driver' for best performance." -ForegroundColor Gray
        Write-Host "    2. Open tray icon > Admin Properties > set a VNC Password." -ForegroundColor Gray
        Write-Host "    3. Allow inbound TCP on port $VncPort in Windows Firewall." -ForegroundColor Gray
        Write-Host "    4. Start the UltraVNC Server service from the tray icon." -ForegroundColor Gray
        Write-Host ''
    }
}

# ---------------------------------------------------------------------------
# Create desktop launcher
# ---------------------------------------------------------------------------
function New-Launcher {
    param([string]$Root, [string]$HttpPort)

    Write-Header 'Step 8 - Desktop launcher'

    $desktop = [Environment]::GetFolderPath('Desktop')
    $batPath = Join-Path $desktop 'Start WebVNC.bat'

    # Write batch file using an array of lines to avoid here-string quoting issues
    $lines = @(
        '@echo off',
        'title WebVNC',
        'echo.',
        'echo  Starting WebVNC...',
        "cd /d `"$Root`"",
        'node dist\server\index.js',
        'pause'
    )
    $lines | Set-Content -Path $batPath -Encoding ASCII
    Write-OK "Batch launcher: $batPath"

    # Create a .lnk shortcut as well (nicer icon, no visible .bat extension)
    try {
        $wsh  = New-Object -ComObject WScript.Shell
        $link = $wsh.CreateShortcut((Join-Path $desktop 'Start WebVNC.lnk'))
        $link.TargetPath       = 'cmd.exe'
        $link.Arguments        = "/k `"cd /d `"$Root`" && node dist\server\index.js`""
        $link.WorkingDirectory = $Root
        $link.Description      = "Start the WebVNC server (http://localhost:$HttpPort)"
        $link.WindowStyle      = 1
        $link.Save()
        Write-OK 'Shortcut (.lnk) also created on Desktop.'
    } catch {
        Write-Warn "Could not create .lnk shortcut ($_). The .bat launcher will still work."
    }
}

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
function Write-Summary {
    param([string]$Root, [hashtable]$Cfg, [bool]$HasWebsockify)

    Write-Host ''
    Write-Host '  +----------------------------------------------------+' -ForegroundColor Green
    Write-Host '  |               Setup complete!                      |' -ForegroundColor Green
    Write-Host '  +----------------------------------------------------+' -ForegroundColor Green
    Write-Host ''
    Write-Host '  Installation directory:' -ForegroundColor White
    Write-Host "    $Root" -ForegroundColor Gray
    Write-Host ''
    Write-Host '  To start WebVNC:' -ForegroundColor White
    Write-Host "    Double-click 'Start WebVNC' on your Desktop" -ForegroundColor Gray
    Write-Host ''
    Write-Host '  Then open your browser at:' -ForegroundColor White
    Write-Host "    http://localhost:$($Cfg.httpPort)" -ForegroundColor Cyan
    Write-Host ''
    if ($HasWebsockify) {
        Write-Host '  Standalone websockify bridge command:' -ForegroundColor White
        Write-Host "    websockify $($Cfg.wsPort) $($Cfg.vncHost):$($Cfg.vncPort)" -ForegroundColor Gray
        Write-Host ''
    } else {
        Write-Host '  The built-in bridge will start automatically with WebVNC.' -ForegroundColor Gray
        Write-Host "  It will proxy WebSocket connections to $($Cfg.vncHost):$($Cfg.vncPort)." -ForegroundColor Gray
        Write-Host ''
    }
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
try {
    Clear-Host
    Write-Banner

    # Where to install
    Write-Host '  Where should WebVNC be installed?' -ForegroundColor White
    $installDir = Read-Value '  Install directory' $INSTALL_DIR_DEFAULT
    Write-Host ''

    if ([string]::IsNullOrWhiteSpace($installDir)) {
        Write-Fail 'Install directory cannot be empty. Please specify a valid directory.'
        Exit-WithPause
    }

    # Steps
    Install-NodeJs
    $root = Get-WebVNC -InstallDir $installDir
    Build-WebVNC    -Root $root
    $cfg  = Write-EnvFile   -Root $root
    $ws   = Install-Websockify
    Prompt-UltraVNC -VncPort $cfg.vncPort
    New-Launcher    -Root $root -HttpPort $cfg.httpPort
    Write-Summary   -Root $root -Cfg $cfg -HasWebsockify $ws

} catch {
    Write-Host ''
    Write-Fail "An unexpected error occurred:"
    Write-Fail "  $_"
    Write-Fail "  $($_.ScriptStackTrace)"
    Write-Host ''
}

Read-Host '  Press Enter to exit'
