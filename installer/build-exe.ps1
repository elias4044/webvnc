#Requires -Version 5.1
<#
.SYNOPSIS
    Compiles webvnc-setup.ps1 into a standalone Windows .exe using ps2exe.

.DESCRIPTION
    Installs ps2exe from the PowerShell Gallery if not already present, then
    compiles the WebVNC installer script into a self-contained executable that
    can be distributed and run on any Windows 10/11 machine without needing
    PowerShell knowledge.

.OUTPUTS
    installer\WebVNC-Setup.exe

.NOTES
    Run once from the project root or the installer\ directory:

        Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
        .\installer\build-exe.ps1
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# ── Resolve paths ──────────────────────────────────────────────────────────────

$installerDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$inputScript  = Join-Path $installerDir "webvnc-setup.ps1"
$outputExe    = Join-Path $installerDir "WebVNC-Setup.exe"

if (-not (Test-Path $inputScript)) {
    Write-Error "webvnc-setup.ps1 not found at: $inputScript"
    exit 1
}

# ── Ensure ps2exe is installed ─────────────────────────────────────────────────

Write-Host ""
Write-Host "  Checking for ps2exe..." -ForegroundColor Cyan

$ps2exeAvailable = $null -ne (Get-Module -ListAvailable -Name ps2exe)

if (-not $ps2exeAvailable) {
    Write-Host "  ps2exe not found. Installing from PSGallery..." -ForegroundColor Yellow
    try {
        Install-Module -Name ps2exe -Scope CurrentUser -Repository PSGallery -Force -AllowClobber
        Write-Host "  [OK] ps2exe installed." -ForegroundColor Green
    } catch {
        Write-Error "Failed to install ps2exe: $_`n`nInstall it manually with: Install-Module ps2exe"
        exit 1
    }
} else {
    Write-Host "  [OK] ps2exe is already installed." -ForegroundColor Green
}

Import-Module ps2exe -Force

# ── Compile ────────────────────────────────────────────────────────────────────

Write-Host ""
Write-Host "  Compiling $inputScript" -ForegroundColor Cyan
Write-Host "        --> $outputExe" -ForegroundColor Cyan
Write-Host ""

$compileParams = @{
    inputFile       = $inputScript
    outputFile      = $outputExe
    title           = "WebVNC Setup"
    description     = "WebVNC Windows Installer"
    company         = "elias4044"
    product         = "WebVNC"
    copyright       = "MIT License"
    version         = "1.0.0.0"
    requireAdmin    = $false   # Set to $true if you want UAC elevation on launch
    noConsole       = $false   # Keep console visible so users can see progress
    noOutput        = $false
    noError         = $false
    supportOS       = $true    # Mark as Windows 10/11 compatible
}

try {
    Invoke-ps2exe @compileParams
} catch {
    # ps2exe sometimes throws but still produces the file; check for it
    if (-not (Test-Path $outputExe)) {
        Write-Error "Compilation failed: $_"
        exit 1
    }
}

if (Test-Path $outputExe) {
    $sizeMb = [math]::Round((Get-Item $outputExe).Length / 1MB, 1)
    Write-Host ""
    Write-Host "  +----------------------------------------------+" -ForegroundColor Green
    Write-Host "  |  Build successful!                           |" -ForegroundColor Green
    Write-Host "  +----------------------------------------------+" -ForegroundColor Green
    Write-Host ""
    Write-Host "  Output : $outputExe" -ForegroundColor White
    Write-Host "  Size   : ${sizeMb} MB" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  Distribute WebVNC-Setup.exe alongside the WebVNC repository" -ForegroundColor Gray
    Write-Host "  (the exe must be inside the installer/ subfolder of the project)." -ForegroundColor Gray
    Write-Host ""
} else {
    Write-Error "Compilation appeared to succeed but output file not found: $outputExe"
    exit 1
}
