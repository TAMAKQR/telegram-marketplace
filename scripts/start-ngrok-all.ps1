Param(
  [int]$WebPort = 5173,
  [int]$SupabasePort = 54321,
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

$config = @"
version: "2"
tunnels:
  web:
    proto: http
    addr: $WebPort
  supabase:
    proto: http
    addr: $SupabasePort
"@

Set-Content -Path $configPath -Value $config -Encoding utf8

Write-Host "Starting ngrok tunnels: web=http://localhost:$WebPort, supabase=http://localhost:$SupabasePort"
Write-Host "(Keep ngrok running while you test. If ngrok isn't authenticated, run: ngrok config add-authtoken <TOKEN>)"

$deadline = (Get-Date).AddSeconds($TimeoutSeconds)
$webUrl = $null
$supabaseUrl = $null

function Try-ReadNgrokTunnels() {
  try {
    $resp = Invoke-RestMethod -Uri 'http://127.0.0.1:4040/api/tunnels' -Method Get -TimeoutSec 2
    $webTunnel = $resp.tunnels | Where-Object { $_.name -eq 'web' -and $_.public_url -like 'https://*' } | Select-Object -First 1
    $supabaseTunnel = $resp.tunnels | Where-Object { $_.name -eq 'supabase' -and $_.public_url -like 'https://*' } | Select-Object -First 1
    return @{
      web = $webTunnel?.public_url
      supabase = $supabaseTunnel?.public_url
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
  # Start ngrok in a separate window so this script can continue.
  if (Test-Path $defaultConfigPath) {
    # Merge default config (authtoken) + generated tunnels config.
    Start-Process -FilePath "ngrok" -ArgumentList @('start', '--all', '--config', $defaultConfigPath, '--config', $configPath) -WindowStyle Normal | Out-Null
  } else {
    # Fallback: run only with the generated config.
    Start-Process -FilePath "ngrok" -ArgumentList @('start', '--all', '--config', $configPath) -WindowStyle Normal | Out-Null
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
    throw "Could not read ngrok tunnels from http://127.0.0.1:4040 within ${TimeoutSeconds}s. ngrok likely exited (common cause: missing authtoken / ERR_NGROK_4018). Run: ngrok config add-authtoken <TOKEN>"
  }

  throw "Could not read both ngrok tunnel URLs from http://127.0.0.1:4040 within ${TimeoutSeconds}s. Is ngrok running?"
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

$content = Get-Content -Raw -Path $envFile

function Upsert-EnvVar([string]$text, [string]$name, [string]$value) {
  if ($text -match "(?m)^${name}=") {
    return [Regex]::Replace($text, "(?m)^${name}=.*$", "${name}=$value")
  }

  $suffix = "`r`n${name}=$value`r`n"
  if ($text -and -not $text.EndsWith("`r`n")) { $text += "`r`n" }
  return $text + $suffix
}

$content = Upsert-EnvVar $content 'VITE_INSTAGRAM_REDIRECT_URI' $redirect
$content = Upsert-EnvVar $content 'VITE_SUPABASE_URL' $supabaseUrl

# Write UTF-8 without BOM (Supabase CLI can choke on BOM in env files)
[System.IO.File]::WriteAllText($envFile, $content, (New-Object System.Text.UTF8Encoding($false)))

Write-Host "Updated .env.local:"
Write-Host "- VITE_INSTAGRAM_REDIRECT_URI=$redirect"
Write-Host "- VITE_SUPABASE_URL=$supabaseUrl"
