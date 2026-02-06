Param(
  [int]$Port = 5173,
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

# Preflight: ngrok v3 requires a verified account + authtoken.
try {
  & ngrok config check *>$null
} catch {
  Write-Host "ngrok config check failed. If ngrok exits with ERR_NGROK_4018, you need to install your authtoken." -ForegroundColor Yellow
  Write-Host "Run: ngrok config add-authtoken <TOKEN>" -ForegroundColor Yellow
}

$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$envFile = Join-Path $repoRoot '.env.local'

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

if (-not (Test-Path $envFile)) {
  throw "Missing .env.local at $envFile"
}

Write-Host "Starting ngrok tunnel for http://localhost:$Port ..."
Write-Host "(ngrok runs as a separate process; keep it running while you test.)"

function Try-ReadNgrokPublicUrl([int]$localPort, [int[]]$inspectPorts) {
  try {
    foreach ($p in $inspectPorts) {
      try {
        $resp = Invoke-RestMethod -Uri "http://127.0.0.1:$p/api/tunnels" -Method Get -TimeoutSec 2

        $expected1 = "http://localhost:$localPort"
        $expected2 = "http://127.0.0.1:$localPort"

        $httpsTunnel = $resp.tunnels |
          Where-Object {
            ($_.public_url -like 'https://*') -and (
              ($_.config -and $_.config.addr -eq $expected1) -or
              ($_.config -and $_.config.addr -eq $expected2)
            )
          } |
          Select-Object -First 1

        # Fallback: if we don't find a matching local addr, pick the first https tunnel.
        if (-not $httpsTunnel) {
          $httpsTunnel = $resp.tunnels | Where-Object { $_.public_url -like 'https://*' } | Select-Object -First 1
        }

        if ($httpsTunnel -and $httpsTunnel.public_url) {
          return $httpsTunnel.public_url
        }
      } catch {
        # try next inspect port
      }
    }

    return $null
  } catch {
    return $null
  }
}

function Get-InspectPorts([int]$preferred) {
  $ports = @()
  if ($preferred -gt 0) { $ports += $preferred }
  $ports += 4040..4050
  return ($ports | Select-Object -Unique)
}

# If ngrok is already running, reuse its existing URL (avoid URL churn).
if (-not $ForceRestart) {
  $existing = Try-ReadNgrokPublicUrl -localPort $Port -inspectPorts (Get-InspectPorts $InspectPort)
  if ($existing) {
    Write-Host "Reusing running ngrok tunnel (no restart)."
  } else {
    # Start ngrok as a detached process so this script can continue.
    # ngrok exposes a local API at http://127.0.0.1:<inspectPort>/api/tunnels (default 4040)
    Start-Process -FilePath "ngrok" -ArgumentList @('http', "$Port", '--inspect=true') -WindowStyle Hidden | Out-Null
  }
} else {
  Start-Process -FilePath "ngrok" -ArgumentList @('http', "$Port", '--inspect=true') -WindowStyle Hidden | Out-Null
}

$deadline = (Get-Date).AddSeconds($TimeoutSeconds)
$publicUrl = $null

while ((Get-Date) -lt $deadline) {
  try {
    $publicUrl = Try-ReadNgrokPublicUrl -localPort $Port -inspectPorts (Get-InspectPorts $InspectPort)
    if ($publicUrl) { break }
  } catch {
    Start-Sleep -Milliseconds 500
  }

  Start-Sleep -Milliseconds 500
}

if (-not $publicUrl) {
  throw "Could not read ngrok public URL from the local inspect API within ${TimeoutSeconds}s. Is ngrok running and exposing the inspect API (default port 4040)?"
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

# Also sync the local Edge Functions dotenv file (used by `supabase functions serve`).
$functionsEnvFile = Join-Path $repoRoot 'supabase\functions\.env'
if (Test-Path $functionsEnvFile) {
  $functionsEnvContent = Get-Content -Raw -Path $functionsEnvFile
  if ($functionsEnvContent -match "(?m)^INSTAGRAM_REDIRECT_URI=") {
    $functionsEnvContent = [Regex]::Replace($functionsEnvContent, "(?m)^INSTAGRAM_REDIRECT_URI=.*$", "INSTAGRAM_REDIRECT_URI=$redirect")
  } else {
    $functionsEnvContent += "`r`nINSTAGRAM_REDIRECT_URI=$redirect`r`n"
  }

  # Write UTF-8 without BOM
  [System.IO.File]::WriteAllText($functionsEnvFile, $functionsEnvContent, (New-Object System.Text.UTF8Encoding($false)))
  Write-Host "Updated supabase/functions/.env: INSTAGRAM_REDIRECT_URI"
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

# Generate runtime /env.js for environments where import.meta.env isn't reliable (Telegram webview, cached builds).
$envMap = Read-DotEnv $envFile
Write-RuntimeEnvJs -repoRoot $repoRoot -envMap $envMap
Write-Host "Updated public/env.js runtime config (window.__ENV__)."