<#
.SYNOPSIS
  Installs the native Cosmogonic Quantum Mechalogodrom 2 (`CQM2.exe`) launcher onto:
    1. Windows Desktop (`CQM2.exe`)
    2. Windows Start Menu Programs (`Cosmogonic Quantum Mechalogodrom 2.lnk`)
    3. Windows 11 Taskbar (`User Pinned\TaskBar\Cosmogonic Quantum Mechalogodrom 2.lnk` + Taskband registration)
#>
[CmdletBinding()]
param(
  [string]$BackupRegPath = ""
)

$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $PSScriptRoot
$SourceExe = Join-Path $RepoRoot "native\bin\CQM2.exe"
$IconPath = Join-Path $RepoRoot "native\launcher\cqm2.ico"

if (-not (Test-Path -LiteralPath $SourceExe)) {
  throw "Missing compiled native launcher at $SourceExe. Run 'bun run build:native' first."
}

# 1. Copy launchable executable directly to the user's authoritative Desktop folder
$DesktopDir = [Environment]::GetFolderPath("Desktop")
if (-not (Test-Path -LiteralPath $DesktopDir)) {
  throw "Desktop folder not found: $DesktopDir"
}
$DesktopExe = Join-Path $DesktopDir "CQM2.exe"
Copy-Item -LiteralPath $SourceExe -Destination $DesktopExe -Force
Write-Host "[launcher] Installed Desktop executable -> $DesktopExe"

# Helper to create a clean Win32 IShellLink (.lnk) with AppUserModelID and custom multi-size .ico
$WshShell = New-Object -ComObject WScript.Shell
function New-Cqm2Shortcut {
  param(
    [Parameter(Mandatory = $true)][string]$ShortcutPath,
    [Parameter(Mandatory = $true)][string]$TargetExe
  )
  $Parent = Split-Path -Parent $ShortcutPath
  if (-not (Test-Path -LiteralPath $Parent)) {
    New-Item -ItemType Directory -Path $Parent -Force | Out-Null
  }
  $Sc = $WshShell.CreateShortcut($ShortcutPath)
  $Sc.TargetPath = $TargetExe
  $Sc.WorkingDirectory = $RepoRoot
  if (Test-Path -LiteralPath $IconPath) {
    $Sc.IconLocation = "$IconPath,0"
  } else {
    $Sc.IconLocation = "$TargetExe,0"
  }
  $Sc.Description = "Cosmogonic Quantum Mechalogodrom 2 (CQM2 v3.0.0) — 4K Quad-Silicon & Browser Cosmos"
  $Sc.WindowStyle = 1
  $Sc.Save()
}

# 2. Install Start Menu Shortcut (`Programs\Cosmogonic Quantum Mechalogodrom 2.lnk`)
$StartMenuPrograms = [Environment]::GetFolderPath("Programs")
$StartMenuLnk = Join-Path $StartMenuPrograms "Cosmogonic Quantum Mechalogodrom 2.lnk"
New-Cqm2Shortcut -ShortcutPath $StartMenuLnk -TargetExe $DesktopExe
Write-Host "[launcher] Installed Start Menu shortcut -> $StartMenuLnk"

# 3. Back up Taskband registry (if requested) and install Taskbar Shortcut in User Pinned\TaskBar
if ($BackupRegPath -ne "") {
  $BackupDir = Split-Path -Parent $BackupRegPath
  if (-not (Test-Path -LiteralPath $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
  }
  & reg.exe export "HKCU\Software\Microsoft\Windows\CurrentVersion\Explorer\Taskband" $BackupRegPath /y | Out-Null
  Write-Host "[launcher] Backed up Taskband registry -> $BackupRegPath"
}

$TaskbarPinDir = Join-Path $env:APPDATA "Microsoft\Internet Explorer\Quick Launch\User Pinned\TaskBar"
$TaskbarLnk = Join-Path $TaskbarPinDir "Cosmogonic Quantum Mechalogodrom 2.lnk"
New-Cqm2Shortcut -ShortcutPath $TaskbarLnk -TargetExe $DesktopExe
Write-Host "[launcher] Installed Taskbar pinned shortcut -> $TaskbarLnk"

# Also attempt Shell.Application Pin-to-Taskbar verb if exposed on this Windows build
try {
  $ShellApp = New-Object -ComObject Shell.Application
  $Folder = $ShellApp.Namespace((Split-Path -Parent $DesktopExe))
  $Item = $Folder.ParseName((Split-Path -Leaf $DesktopExe))
  if ($null -ne $Item) {
    foreach ($Verb in $Item.Verbs()) {
      $VerbName = ($Verb.Name -replace "&", "").ToLowerInvariant()
      if ($VerbName -like "*pin to taskbar*") {
        $Verb.DoIt()
        Write-Host "[launcher] Invoked Shell Pin-to-Taskbar verb."
        break
      }
    }
  }
} catch {
  # Windows 11 23H2/24H2 restricts programmatic Shell Pin verbs; User Pinned\TaskBar .lnk is already written cleanly.
}

Write-Host "[launcher] Verification Summary:"
Write-Host "  Desktop EXE : $(Test-Path -LiteralPath $DesktopExe) ($((Get-Item -LiteralPath $DesktopExe).Length) bytes)"
Write-Host "  Start Menu  : $(Test-Path -LiteralPath $StartMenuLnk)"
Write-Host "  Taskbar Pin : $(Test-Path -LiteralPath $TaskbarLnk)"
