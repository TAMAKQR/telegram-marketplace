Param(
  [int]$Port = 5173,
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

Write-Host "Starting ngrok tunnel for http://localhost:$Port ..."
Write-Host "(A new ngrok window may open. Keep it running while you test.)"

function Try-ReadNgrokPublicUrl() {
  try {
    $resp = Invoke-RestMethod -Uri 'http://127.0.0.1:4040/api/tunnels' -Method Get -TimeoutSec 2
    $httpsTunnel = $resp.tunnels | Where-Object { $_.public_url -like 'https://*' } | Select-Object -First 1
    return $httpsTunnel?.public_url
  } catch {
    return $null
  }
}

# If ngrok is already running, reuse its existing URL (avoid URL churn).
if (-not $ForceRestart) {
  $existing = Try-ReadNgrokPublicUrl
  if ($existing) {
    Write-Host "Reusing running ngrok tunnel (no restart)."
  } else {
    # Start ngrok in a separate window so this script can continue.
    # ngrok exposes a local API at http://127.0.0.1:4040/api/tunnels
    Start-Process -FilePath "ngrok" -ArgumentList @('http', "$Port") -WindowStyle Normal | Out-Null
  }
} else {
  Start-Process -FilePath "ngrok" -ArgumentList @('http', "$Port") -WindowStyle Normal | Out-Null
}

$deadline = (Get-Date).AddSeconds($TimeoutSeconds)
$publicUrl = $null

while ((Get-Date) -lt $deadline) {
  try {
    $publicUrl = Try-ReadNgrokPublicUrl
    if ($publicUrl) { break }
  } catch {
    Start-Sleep -Milliseconds 500
  }

  Start-Sleep -Milliseconds 500
}

if (-not $publicUrl) {
  throw "Could not read ngrok public URL from http://127.0.0.1:4040 within ${TimeoutSeconds}s. Is ngrok running?"
}

$redirect = "$publicUrl/instagram/callback"
Write-Host "ngrok public URL: $publicUrl"
Write-Host "Instagram redirect URI: $redirect"

# Keep Supabase Edge Function secrets in sync (redirect_uri must match on both client + server).
$secretsFile = Join-Path $repoRoot 'supabase\functions\SECRETS.local'
if (Test-Path $secretsFile) {
  $secretsContent = Get-Content -Raw -Path $secretsFile
  if ($secretsContent -match "(?m)^INSTAGRAM_REDIRECT_URI=") {
    $secretsContent = [Regex]::Replace($secretsContent, "(?m)^INSTAGRAM_REDIRECT_URI=.*$", "INSTAGRAM_REDIRECT_URI=$redirect")
  } else {
    $secretsContent += "`r`nINSTAGRAM_REDIRECT_URI=$redirect`r`n"
  }

  # Write UTF-8 without BOM (Supabase CLI can choke on BOM in env files)
  [System.IO.File]::WriteAllText($secretsFile, $secretsContent, (New-Object System.Text.UTF8Encoding($false)))
  Write-Host "Updated Supabase function secrets: INSTAGRAM_REDIRECT_URI"
}

# Update .env.local
$content = Get-Content -Raw -Path $envFile
if ($content -match "(?m)^VITE_INSTAGRAM_REDIRECT_URI=") {
  $content = [Regex]::Replace($content, "(?m)^VITE_INSTAGRAM_REDIRECT_URI=.*$", "VITE_INSTAGRAM_REDIRECT_URI=$redirect")
} else {
  $content += "`r`nVITE_INSTAGRAM_REDIRECT_URI=$redirect`r`n"
}

# Write UTF-8 without BOM (Supabase CLI can choke on BOM in env files)
[System.IO.File]::WriteAllText($envFile, $content, (New-Object System.Text.UTF8Encoding($false)))

Write-Host "Updated .env.local: VITE_INSTAGRAM_REDIRECT_URI=$redirect"