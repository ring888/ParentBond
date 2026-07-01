[CmdletBinding()]
param(
  [ValidateSet("all", "api", "web")]
  [string]$Service = "all",

  [switch]$NoCache,
  [switch]$Pull,
  [switch]$SkipBuild,
  [switch]$SkipHealthCheck,

  [int]$HealthTimeoutSeconds = 120
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Resolve-Path (Join-Path $ScriptDir "..")
Set-Location $ProjectRoot

function Invoke-CommandStep {
  param(
    [Parameter(Mandatory = $true)]
    [string]$FilePath,

    [Parameter(Mandatory = $true)]
    [string[]]$Arguments
  )

  Write-Host ""
  Write-Host "> $FilePath $($Arguments -join ' ')" -ForegroundColor Cyan
  & $FilePath @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "Command failed with exit code $LASTEXITCODE."
  }
}

function Invoke-Compose {
  param([Parameter(Mandatory = $true)][string[]]$Arguments)
  Invoke-CommandStep -FilePath "docker" -Arguments (@("compose") + $Arguments)
}

function Get-DotEnvValue {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Name,

    [Parameter(Mandatory = $true)]
    [string]$DefaultValue
  )

  if (-not (Test-Path -LiteralPath ".env")) {
    return $DefaultValue
  }

  $escapedName = [regex]::Escape($Name)
  $line = Get-Content -LiteralPath ".env" |
    Where-Object { $_ -match "^\s*$escapedName=" } |
    Select-Object -First 1

  if (-not $line) {
    return $DefaultValue
  }

  return (($line -replace "^\s*$escapedName=", "").Trim().Trim('"').Trim("'"))
}

function Test-ApiHealth {
  $healthScript = "fetch('http://127.0.0.1:3000/api/v1/health').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
  & docker compose exec -T api node -e $healthScript | Out-Null
  return $LASTEXITCODE -eq 0
}

function Wait-ForApiHealth {
  param([Parameter(Mandatory = $true)][int]$TimeoutSeconds)

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  Write-Host ""
  Write-Host "Waiting for API health check..." -ForegroundColor Cyan

  while ((Get-Date) -lt $deadline) {
    if (Test-ApiHealth) {
      Write-Host "API health check passed." -ForegroundColor Green
      return
    }

    Start-Sleep -Seconds 3
  }

  throw "API health check did not pass within $TimeoutSeconds seconds. Run 'docker compose logs -f api' for details."
}

if (-not (Test-Path -LiteralPath "docker-compose.yml")) {
  throw "docker-compose.yml was not found. Run this script from the ParentBond project."
}

if (-not (Test-Path -LiteralPath ".env")) {
  throw ".env was not found. Copy .env.docker.example to .env and edit it before deploying."
}

$targets = if ($Service -eq "all") { @("api", "web") } else { @($Service) }

Write-Host "ParentBond Docker update" -ForegroundColor Green
Write-Host "Project: $ProjectRoot"
Write-Host "Target:  $($targets -join ', ')"

Invoke-CommandStep -FilePath "docker" -Arguments @("--version")
Invoke-Compose -Arguments @("version")

if (-not $SkipBuild) {
  $buildArgs = @("build")
  if ($Pull) {
    $buildArgs += "--pull"
  }
  if ($NoCache) {
    $buildArgs += "--no-cache"
  }
  $buildArgs += $targets
  Invoke-Compose -Arguments $buildArgs
}

Invoke-Compose -Arguments (@("up", "-d", "--remove-orphans") + $targets)

if (-not $SkipHealthCheck) {
  Wait-ForApiHealth -TimeoutSeconds $HealthTimeoutSeconds
}

Invoke-Compose -Arguments @("ps")

$webPort = Get-DotEnvValue -Name "WEB_PORT" -DefaultValue "8080"
Write-Host ""
Write-Host "Update finished. Open: http://localhost:$webPort" -ForegroundColor Green
Write-Host "For logs: docker compose logs -f api web" -ForegroundColor Yellow
