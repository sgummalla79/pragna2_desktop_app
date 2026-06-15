#Requires -Version 5.0
<#
.SYNOPSIS
  Kill any running Pragna dev instance, then start a clean `pnpm tauri dev`.

.DESCRIPTION
  The Vite dev server uses strictPort (:1420) — a leftover instance (e.g. an e2e
  FE server, or a previous run whose window was force-quit) makes a new
  `tauri dev` fail with "Port 1420 is already in use". This frees the dev ports
  and closes any stray Tauri dev window first.

  Windows. macOS / Linux: use scripts/dev-clean.sh.
  Run via: pnpm dev:clean:win   (or: powershell -ExecutionPolicy Bypass -File scripts/dev-clean.ps1)
#>
$ErrorActionPreference = 'SilentlyContinue'

# Run from the repo root (this script lives in <root>/scripts).
Set-Location (Join-Path $PSScriptRoot '..')

# Vite dev port + HMR port (see vite.config.ts: server.port 1420 strictPort, hmr 1421).
$ports = 1420, 1421
# The Tauri dev app's process name = the src-tauri Cargo bin name (no .exe in -Name).
$appName = 'pragna2_desktop_app'

Write-Host "Cleaning up any running Pragna dev instance..."

# Close the Tauri dev app window/process by exact name.
$app = Get-Process -Name $appName -ErrorAction SilentlyContinue
if ($app) {
  Write-Host "  killing app process: $appName (PID $($app.Id -join ', '))"
  $app | Stop-Process -Force -ErrorAction SilentlyContinue
}

# Free the dev ports (kills the Vite server holding :1420).
foreach ($p in $ports) {
  $owners = Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess -Unique
  foreach ($procId in $owners) {
    if ($procId) {
      Write-Host "  freeing :$p -> PID $procId"
      Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
    }
  }
}

Start-Sleep -Seconds 1

Write-Host "Starting clean: pnpm tauri dev"
pnpm tauri dev
