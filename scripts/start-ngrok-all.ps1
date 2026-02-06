Param(
  [int]$WebPort = 5173,
  [int]$SupabasePort = 54321,
  [int]$InspectPort = 4040,
  [int]$TimeoutSeconds = 30,
  [switch]$ForceRestart
)

$ErrorActionPreference = 'Stop'

function Require-Command($name) {
  if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
    throw "Required command not found: $name"
  }
}

Require-Command ngrok

function Upsert-EnvVar([string]$text, [string]$name, [string]$value) {
  if ($text -match "(?m)^${name}=") {
    return [Regex]::Replace($text, "(?m)^${name}=.*$", "${name}=$value")
  }

  $suffix = "`r`n${name}=$value`r`n"
  if ($text -and -not $text.EndsWith("`r`n")) { $text += "`r`n" }
  return $text + $suffix
}

function Read-DotEnv([string]$path) {
  $map = @{}
  if (-not (Test-Path $path)) { return $map }

  $lines = Get-Content -Path $path
  foreach ($line in $lines) {
    if (-not $line) { continue }
    $trim = $line.Trim()
    if (-not $trim -or $trim.StartsWith('#')) { continue }

    $idx = $trim.IndexOf('=')
    if ($idx -lt 1) { continue }
    $k = $trim.Substring(0, $idx).Trim()
    $v = $trim.Substring($idx + 1).Trim()
    if ($k) { $map[$k] = $v }
  }

  return $map
}

function Write-RuntimeEnvJs([string]$repoRoot, [hashtable]$envMap) {
  $publicEnvJs = Join-Path $repoRoot 'public\env.js'
  $nl = "`r`n"
  $pairs = @()
  foreach ($k in $envMap.Keys) {
    if ($k -like 'VITE_*') {
      $escapedV = ($envMap[$k] -replace '\\', '\\\\' -replace '"', '\\"')
      $pairs += "  `"$k`": `"$escapedV`""
    }
  }

  $body = "window.__ENV__ = window.__ENV__ || {};${nl}window.__ENV__ = Object.assign(window.__ENV__, {${nl}" + ($pairs -join ",${nl}") + "${nl}});${nl}"
  [System.IO.File]::WriteAllText($publicEnvJs, $body, (New-Object System.Text.UTF8Encoding($false)))
}

# Preflight: ngrok v3 requires a verified account + authtoken.
try {
  & ngrok config check *>$null
} catch {
  Write-Host "ngrok config check failed. If ngrok exits with ERR_NGROK_4018, you need to install your authtoken." -ForegroundColor Yellow
  Write-Host "Run: ngrok config add-authtoken <TOKEN>" -ForegroundColor Yellow
}

$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$envFile = Join-Path $repoRoot '.env.local'

if (-not (Test-Path $envFile)) {
  throw "Missing .env.local at $envFile"
}

$configPath = Join-Path $env:TEMP ("ngrok.telegramwebapp.{0}.yml" -f ([System.Guid]::NewGuid().ToString('N')))
$defaultConfigPath = Join-Path $env:LOCALAPPDATA 'ngrok\ngrok.yml'

# ngrok v3 config file (tunnels section is supported)
$config = @"
version: 3
tunnels:
  web:
    proto: http
    addr: 127.0.0.1:$WebPort
  supabase:
    proto: http
    addr: 127.0.0.1:$SupabasePort
"@

[System.IO.File]::WriteAllText($configPath, $config, (New-Object System.Text.UTF8Encoding($false)))

Write-Host "Starting ngrok tunnels: web=http://localhost:$WebPort, supabase=http://localhost:$SupabasePort"
Write-Host "(Keep ngrok running while you test. If ngrok isn't authenticated, run: ngrok config add-authtoken <TOKEN>)"

$deadline = (Get-Date).AddSeconds($TimeoutSeconds)
$webUrl = $null
$supabaseUrl = $null

function Try-ReadNgrokTunnels() {
  try {
    $resp = Invoke-RestMethod -Uri "http://127.0.0.1:$InspectPort/api/tunnels" -Method Get -TimeoutSec 2
    $webTunnel = $resp.tunnels | Where-Object { $_.name -eq 'web' -and $_.public_url -like 'https://*' } | Select-Object -First 1
    $supabaseTunnel = $resp.tunnels | Where-Object { $_.name -eq 'supabase' -and $_.public_url -like 'https://*' } | Select-Object -First 1

    $webUrl = $null
    $supabaseUrl = $null
    if ($webTunnel -and $webTunnel.public_url) { $webUrl = $webTunnel.public_url }
    if ($supabaseTunnel -and $supabaseTunnel.public_url) { $supabaseUrl = $supabaseTunnel.public_url }

    return @{
      web = $webUrl
      supabase = $supabaseUrl
    }
  } catch {
    return $null
  }
}

if (-not $ForceRestart) {
  $existing = Try-ReadNgrokTunnels
  if ($existing -and $existing.web -and $existing.supabase) {
    $webUrl = $existing.web
    $supabaseUrl = $existing.supabase
    Write-Host "Reusing running ngrok tunnels (no restart)."
  }
}

if (-not $webUrl -or -not $supabaseUrl) {
  if ($ForceRestart) {
    Get-Process ngrok -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Milliseconds 250
  }

  # Start ngrok in a separate window so this script can continue.
  if (Test-Path $defaultConfigPath) {
    # Merge default config (authtoken) + generated tunnels config.
    Start-Process -FilePath "ngrok" -ArgumentList @('start', '--all', '--config', $defaultConfigPath, '--config', $configPath, '--log', 'stdout') -WindowStyle Hidden | Out-Null
  } else {
    # Fallback: run only with the generated config.
    Start-Process -FilePath "ngrok" -ArgumentList @('start', '--all', '--config', $configPath, '--log', 'stdout') -WindowStyle Hidden | Out-Null
  }
}

while ((Get-Date) -lt $deadline -and (-not $webUrl -or -not $supabaseUrl)) {
  $current = Try-ReadNgrokTunnels
  if ($current) {
    if ($current.web) { $webUrl = $current.web }
    if ($current.supabase) { $supabaseUrl = $current.supabase }
  }

  if ($webUrl -and $supabaseUrl) { break }
  Start-Sleep -Milliseconds 500
}

if (-not $webUrl -or -not $supabaseUrl) {
  try {
    & ngrok config check | Out-Null
  } catch {
    throw "Could not read ngrok tunnels from http://127.0.0.1:$InspectPort within ${TimeoutSeconds}s. ngrok likely exited (common cause: missing authtoken / ERR_NGROK_4018). Run: ngrok config add-authtoken <TOKEN>"
  }

  throw "Could not read both ngrok tunnel URLs from http://127.0.0.1:$InspectPort within ${TimeoutSeconds}s. Is ngrok running?"
}

$redirect = "$webUrl/instagram/callback"

Write-Host "ngrok web URL: $webUrl"
Write-Host "ngrok supabase URL: $supabaseUrl"
Write-Host "Instagram redirect URI: $redirect"

# Keep Supabase Edge Function secrets in sync (redirect_uri must match on both client + server).
$secretsFile = Join-Path $repoRoot 'supabase\functions\SECRETS.local'
if (Test-Path $secretsFile) {
  $secretsContent = Get-Content -Raw -Path $secretsFile
  $secretsContent = Upsert-EnvVar $secretsContent 'INSTAGRAM_REDIRECT_URI' $redirect
  [System.IO.File]::WriteAllText($secretsFile, $secretsContent, (New-Object System.Text.UTF8Encoding($false)))
  Write-Host "Updated Supabase function secrets: INSTAGRAM_REDIRECT_URI" 
}

# Also sync the local Edge Functions dotenv file (used by local edge runtime)
$functionsEnvFile = Join-Path $repoRoot 'supabase\functions\.env'
if (Test-Path $functionsEnvFile) {
  $functionsEnvContent = Get-Content -Raw -Path $functionsEnvFile
  $functionsEnvContent = Upsert-EnvVar $functionsEnvContent 'INSTAGRAM_REDIRECT_URI' $redirect
  [System.IO.File]::WriteAllText($functionsEnvFile, $functionsEnvContent, (New-Object System.Text.UTF8Encoding($false)))
  Write-Host "Updated supabase/functions/.env: INSTAGRAM_REDIRECT_URI"
}

$content = Get-Content -Raw -Path $envFile
$content = Upsert-EnvVar $content 'VITE_INSTAGRAM_REDIRECT_URI' $redirect
$content = Upsert-EnvVar $content 'VITE_SUPABASE_URL' $supabaseUrl

# Write UTF-8 without BOM (Supabase CLI can choke on BOM in env files)
[System.IO.File]::WriteAllText($envFile, $content, (New-Object System.Text.UTF8Encoding($false)))

Write-Host "Updated .env.local:"
Write-Host "- VITE_INSTAGRAM_REDIRECT_URI=$redirect"
Write-Host "- VITE_SUPABASE_URL=$supabaseUrl"

# Generate runtime /env.js for environments where import.meta.env isn't reliable (Telegram webview, cached builds).
$envMap = Read-DotEnv $envFile
Write-RuntimeEnvJs -repoRoot $repoRoot -envMap $envMap
Write-Host "Updated public/env.js runtime config (window.__ENV__)."
