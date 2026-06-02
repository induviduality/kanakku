#requires -Version 5
<#
.SYNOPSIS
  Local code-quality helper for Kanakku (Windows / PowerShell).
  Backend and frontend are fully separate: separate tests, coverage, and SonarQube
  dashboards. Everything runs locally — nothing is uploaded anywhere.

.DESCRIPTION
  Commands:
    --- Backend ---
    test-backend       Run BE tests (pytest)                  needs a test Postgres
    coverage-backend   BE tests + coverage                    -> backend/coverage.xml, backend/htmlcov/
    lint-backend       ruff + mypy + bandit                   -> backend/reports/
    scan-backend       Scan BE into SonarQube project 'kanakku-backend'
    backend            coverage-backend + lint-backend + scan-backend

    --- Frontend ---
    test-frontend      Run FE tests (vitest)
    coverage-frontend  FE tests + coverage                    -> frontend/coverage/ (html + lcov)
    lint-frontend      eslint                                 -> frontend/reports/
    scan-frontend      Scan FE into SonarQube project 'kanakku-frontend'
    frontend           coverage-frontend + lint-frontend + scan-frontend

    --- Server ---
    sonar-up / sonar-down   Start / stop local SonarQube (http://localhost:9000)
    help

.EXAMPLE
  .\scripts\quality.ps1 sonar-up
  $env:SONAR_TOKEN = "squ_xxx"          # SonarQube > My Account > Security
  .\scripts\quality.ps1 coverage-backend
  .\scripts\quality.ps1 scan-backend
#>
param([Parameter(Position = 0)][string]$Command = "help")

$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root
$Compose = "infra/sonarqube/docker-compose.yml"

if (Test-Path ".env") {
  Get-Content ".env" | Where-Object { $_ -match "^[A-Za-z0-9_]+=" } | ForEach-Object {
    $name, $value = $_.Split('=', 2)
    Set-Item -Path "Env:\$name" -Value $value.Trim()
  }
}

# ── Backend ─────────────────────────────────────────────────────────────────────
function Test-Backend {
  Write-Host "==> Backend tests (pytest)" -ForegroundColor Cyan
  Push-Location backend; try { uv run --extra dev pytest } finally { Pop-Location }
}
function Coverage-Backend {
  Write-Host "==> Backend coverage (pytest + coverage.py)" -ForegroundColor Cyan
  Push-Location backend
  try {
    uv run --extra dev pytest --cov=app --cov-report=xml --cov-report=html --cov-report=term-missing
    if (Test-Path coverage.xml) {
      $xml = Get-Content coverage.xml -Raw
      $winPath = (Get-Location).Path
      $xml = $xml.Replace($winPath, "/usr/src").Replace($winPath.Replace('\', '/'), "/usr/src")
      Set-Content coverage.xml $xml
    }
    Write-Host "    backend/coverage.xml + backend/htmlcov/index.html" -ForegroundColor DarkGray
  } finally { Pop-Location }
}
function Lint-Backend {
  Write-Host "==> Backend lint (ruff + mypy + bandit)" -ForegroundColor Cyan
  New-Item -ItemType Directory -Force -Path backend/reports | Out-Null
  Push-Location backend
  try {
    uv run --extra dev ruff check . --output-format json | Out-File -Encoding utf8 reports/ruff.json
    uv run --extra dev ruff check .
    uv run --extra dev mypy app 2>&1 | Tee-Object -FilePath reports/mypy.txt
    uv run --extra dev bandit -r app -f json -o reports/bandit.json
  } catch { Write-Warning $_ } finally { Pop-Location }
}
function Scan-Backend { Invoke-Scan "backend" "kanakku-backend" }

# ── Frontend ────────────────────────────────────────────────────────────────────
function Test-Frontend {
  Write-Host "==> Frontend tests (vitest)" -ForegroundColor Cyan
  Push-Location frontend
  try { if (-not (Test-Path node_modules)) { bun install --frozen-lockfile }; bun run test } finally { Pop-Location }
}
function Coverage-Frontend {
  Write-Host "==> Frontend coverage (vitest v8)" -ForegroundColor Cyan
  Push-Location frontend
  try {
    if (-not (Test-Path node_modules)) { bun install --frozen-lockfile }
    bun run coverage
    Write-Host "    frontend/coverage/lcov.info + frontend/coverage/index.html" -ForegroundColor DarkGray
  } finally { Pop-Location }
}
function Lint-Frontend {
  Write-Host "==> Frontend lint (eslint)" -ForegroundColor Cyan
  New-Item -ItemType Directory -Force -Path frontend/reports | Out-Null
  Push-Location frontend
  try {
    if (-not (Test-Path node_modules)) { bun install --frozen-lockfile }
    bunx eslint . -f json -o reports/eslint.json
    bun run lint
  } catch { Write-Warning $_ } finally { Pop-Location }
}
function Scan-Frontend { Invoke-Scan "frontend" "kanakku-frontend" }

# ── Shared ──────────────────────────────────────────────────────────────────────
function Invoke-Scan([string]$SubDir, [string]$ProjectKey) {
  $token = $env:SONAR_TOKEN
  if ($ProjectKey -eq "kanakku-backend" -and $env:BE_SONAR_TOKEN) { $token = $env:BE_SONAR_TOKEN }
  if ($ProjectKey -eq "kanakku-frontend" -and $env:FE_SONAR_TOKEN) { $token = $env:FE_SONAR_TOKEN }

  if (-not $token) {
    throw "Set `$env:SONAR_TOKEN, `$env:BE_SONAR_TOKEN, or `$env:FE_SONAR_TOKEN first via .env or directly (SonarQube > My Account > Security > Generate Token)."
  }
  $hostUrl = if ($env:SONAR_HOST_URL) { $env:SONAR_HOST_URL } else { "http://host.docker.internal:9000" }
  Write-Host "==> Scanning $SubDir -> $ProjectKey ($hostUrl)" -ForegroundColor Cyan
  docker run --rm `
    -e SONAR_HOST_URL=$hostUrl `
    -e SONAR_TOKEN=$token `
    -v "$Root/$SubDir`:/usr/src" `
    sonarsource/sonar-scanner-cli
  Write-Host "    Dashboard: $hostUrl/dashboard?id=$ProjectKey" -ForegroundColor Green
}
function Sonar-Up {
  Write-Host "==> Starting local SonarQube (first boot ~1-2 min)" -ForegroundColor Cyan
  docker compose -f $Compose up -d
  Write-Host "    Open http://localhost:9000  (first login: admin / admin)" -ForegroundColor Green
}
function Sonar-Down { docker compose -f $Compose down }

switch ($Command.ToLower()) {
  "test-backend"      { Test-Backend }
  "coverage-backend"  { Coverage-Backend }
  "lint-backend"      { Lint-Backend }
  "scan-backend"      { Scan-Backend }
  "backend"           { Coverage-Backend; Lint-Backend; Scan-Backend }

  "test-frontend"     { Test-Frontend }
  "coverage-frontend" { Coverage-Frontend }
  "lint-frontend"     { Lint-Frontend }
  "scan-frontend"     { Scan-Frontend }
  "frontend"          { Coverage-Frontend; Lint-Frontend; Scan-Frontend }

  "sonar-up"          { Sonar-Up }
  "sonar-down"        { Sonar-Down }
  default { Get-Help $PSCommandPath -Detailed | Out-String | Write-Host }
}
