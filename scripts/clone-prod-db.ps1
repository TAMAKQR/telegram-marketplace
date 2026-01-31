Param(
  [switch]$SchemaOnly,
  [switch]$DataOnly,
  [switch]$AllSchemas,
  [switch]$StartSupabase,
  [bool]$CleanLocalPublicSchema = $true,
  [switch]$Force
)

$ErrorActionPreference = 'Stop'

function Require-Command($name) {
  if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
    throw "Required command not found: $name"
  }
}

function Assert-LastExitCode([string]$what) {
  if ($LASTEXITCODE -ne 0) {
    throw "$what failed with exit code $LASTEXITCODE"
  }
}

Require-Command docker

if ($StartSupabase) {
  $supabase = Get-Command supabase -ErrorAction SilentlyContinue
  if ($supabase) {
    Write-Host "Starting local Supabase via 'supabase start'..."
    & supabase start | Out-Null
  } else {
    $npx = Get-Command npx -ErrorAction SilentlyContinue
    if (-not $npx) {
      throw "To use -StartSupabase, install Supabase CLI or Node.js (for npx)."
    }

    Write-Host "Starting local Supabase via 'npx supabase@latest start'..."
    & npx --yes supabase@latest start | Out-Null
  }
}

Write-Host "Local Supabase should be running. Ensure you ran 'npx supabase@latest start' and have LOCAL_DB_URL." 

if (-not $env:SUPABASE_DB_URL) {
  throw "Set `SUPABASE_DB_URL` env var to your production database connection string (postgresql://...)."
}

if (-not $env:LOCAL_DB_URL) {
  throw "Set `LOCAL_DB_URL` env var to your local database connection string. You can get it from 'supabase status'."
}

function Normalize-LocalDbUrlForDocker([string]$url) {
  # When we run psql inside a docker container, localhost/127.0.0.1 refers to the container.
  # On Docker Desktop, host.docker.internal points back to the host machine.
  return $url.Replace('@127.0.0.1:', '@host.docker.internal:').Replace('@localhost:', '@host.docker.internal:')
}

$dumpPath = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\supabase\seed.prod.sql'))

$commonArgs = @(
  '--no-owner',
  '--no-privileges'
)

# By default, dump only the application schema to avoid conflicts with Supabase internal schemas.
if (-not $AllSchemas) {
  $commonArgs += '--schema=public'
}

$modeArgs = @()
if ($SchemaOnly -and $DataOnly) {
  throw "Choose only one: -SchemaOnly or -DataOnly"
}

if ($SchemaOnly) {
  $modeArgs += '--schema-only'
}

if ($DataOnly) {
  $modeArgs += '--data-only'
  $modeArgs += '--disable-triggers'
}

Write-Host "Dumping from production into $dumpPath ..."
# Use dockerized pg_dump so you don't need local Postgres tools
# Note: SUPABASE_DB_URL contains secrets — do NOT commit the dump file.
$dumpDir = Split-Path -Parent $dumpPath
$dumpFileName = Split-Path -Leaf $dumpPath
docker run --rm -v "${dumpDir}:/out" postgres:17-alpine pg_dump @commonArgs "$env:SUPABASE_DB_URL" @modeArgs -f "/out/$dumpFileName"
Assert-LastExitCode "pg_dump"

# Local Supabase may run an older Postgres version than production.
# Remove Postgres 17-only GUCs that would otherwise break restore.
Write-Host "Normalizing dump for local Postgres compatibility..."
docker run --rm -v "${dumpDir}:/out" alpine:3.20 sh -c "set -e; grep -v '^SET transaction_timeout' /out/$dumpFileName > /out/$dumpFileName.tmp; mv /out/$dumpFileName.tmp /out/$dumpFileName"
Assert-LastExitCode "normalize dump"

Write-Host "Restoring into local database..."
$localUrlForDocker = Normalize-LocalDbUrlForDocker $env:LOCAL_DB_URL

if ($CleanLocalPublicSchema -and -not $AllSchemas) {
  if (-not $Force) {
    $confirmation = Read-Host "This will DROP SCHEMA public CASCADE on LOCAL_DB_URL and recreate it. Continue? (y/N)"
    if ($confirmation -notin @('y', 'Y')) {
      throw "Aborted by user. Re-run with -Force to skip confirmation."
    }
  }

  Write-Host "Cleaning local public schema..."
  docker run --rm postgres:17-alpine psql "$localUrlForDocker" -v ON_ERROR_STOP=1 -c "DROP SCHEMA IF EXISTS public CASCADE;"
  Assert-LastExitCode "psql clean public schema"
}

docker run --rm -v "${dumpPath}:/dump.sql:ro" postgres:17-alpine psql "$localUrlForDocker" -v ON_ERROR_STOP=1 -f /dump.sql
Assert-LastExitCode "psql restore"

# If the dump was created with --no-privileges, the local roles (anon/authenticated) may lose access to
# the restored schema. Reapply common Supabase-style grants for local development.
$grantsSql = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\supabase\fix_local_grants.sql'))
if (Test-Path $grantsSql) {
  Write-Host "Reapplying local Supabase grants..."
  docker run --rm -v "${grantsSql}:/grants.sql:ro" postgres:17-alpine psql "$localUrlForDocker" -v ON_ERROR_STOP=1 -f /grants.sql
  Assert-LastExitCode "psql reapply grants"
}

Write-Host "Done. Local DB now contains the dumped content."