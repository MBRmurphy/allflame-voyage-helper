param(
  [Parameter(Mandatory = $true)][int]$ProcessId,
  [Parameter(Mandatory = $true)][string]$Source,
  [Parameter(Mandatory = $true)][string]$Target,
  [Parameter(Mandatory = $true)][string]$ExpectedSha256
)

$ErrorActionPreference = "Stop"
$logPath = Join-Path ([System.IO.Path]::GetTempPath()) "PoE-Allflame-Voyage-Helper-update.log"
$newPath = "$Target.update-new"
$backupPath = "$Target.update-old"

function Write-UpdateLog([string]$Message) {
  Add-Content -LiteralPath $logPath -Value "$(Get-Date -Format o) $Message" -Encoding UTF8
}

function Assert-Checksum([string]$PathToCheck) {
  $actual = (Get-FileHash -LiteralPath $PathToCheck -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($actual -ne $ExpectedSha256.ToLowerInvariant()) {
    throw "SHA-256 mismatch for $PathToCheck"
  }
}

try {
  Write-UpdateLog "Waiting for application process $ProcessId to exit"
  for ($waitAttempt = 1; $waitAttempt -le 1200; $waitAttempt += 1) {
    if (!(Get-Process -Id $ProcessId -ErrorAction SilentlyContinue)) { break }
    Start-Sleep -Milliseconds 100
  }
  if (Get-Process -Id $ProcessId -ErrorAction SilentlyContinue) {
    throw "Application did not exit within 120 seconds"
  }

  Assert-Checksum $Source
  $installed = $false
  $lastInstallError = $null

  for ($attempt = 1; $attempt -le 60; $attempt += 1) {
    try {
      Remove-Item -LiteralPath $newPath -Force -ErrorAction SilentlyContinue
      Copy-Item -LiteralPath $Source -Destination $newPath -Force
      Assert-Checksum $newPath
      Remove-Item -LiteralPath $backupPath -Force -ErrorAction SilentlyContinue
      if (Test-Path -LiteralPath $Target) {
        Move-Item -LiteralPath $Target -Destination $backupPath -Force
      }
      Move-Item -LiteralPath $newPath -Destination $Target -Force
      $installed = $true
      break
    } catch {
      $lastInstallError = $_
      Remove-Item -LiteralPath $newPath -Force -ErrorAction SilentlyContinue
      if (!(Test-Path -LiteralPath $Target) -and (Test-Path -LiteralPath $backupPath)) {
        Move-Item -LiteralPath $backupPath -Destination $Target -Force
      }
      Start-Sleep -Seconds 1
    }
  }

  if (!$installed) {
    throw "Could not replace the executable after 60 attempts: $lastInstallError"
  }

  Assert-Checksum $Target
  Start-Process -FilePath $Target -WorkingDirectory (Split-Path -Parent $Target)
  Start-Sleep -Seconds 2
  Remove-Item -LiteralPath $backupPath -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $Source -Force -ErrorAction SilentlyContinue
  Write-UpdateLog "Update installed and restarted successfully"
} catch {
  Write-UpdateLog "Update failed: $($_.Exception.Message)"
  Remove-Item -LiteralPath $newPath -Force -ErrorAction SilentlyContinue
  if (Test-Path -LiteralPath $backupPath) {
    try {
      Remove-Item -LiteralPath $Target -Force -ErrorAction SilentlyContinue
      Move-Item -LiteralPath $backupPath -Destination $Target -Force
      Start-Process -FilePath $Target -WorkingDirectory (Split-Path -Parent $Target)
      Write-UpdateLog "Restored and restarted the previous executable"
    } catch {
      Write-UpdateLog "Rollback failed: $($_.Exception.Message)"
    }
  } elseif (Test-Path -LiteralPath $Target) {
    try {
      Start-Process -FilePath $Target -WorkingDirectory (Split-Path -Parent $Target)
      Write-UpdateLog "Restarted the unchanged executable"
    } catch {
      Write-UpdateLog "Could not restart the unchanged executable: $($_.Exception.Message)"
    }
  }
  exit 1
} finally {
  $stagingDirectory = Split-Path -Parent $PSCommandPath
  Remove-Item -LiteralPath $PSCommandPath -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $stagingDirectory -Recurse -Force -ErrorAction SilentlyContinue
}
