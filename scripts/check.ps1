param(
    [switch]$IncludeE2E
)

$ErrorActionPreference = "Stop"
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$Python = Join-Path $RepoRoot ".venv\Scripts\python.exe"
if (-not (Test-Path $Python)) {
    $Python = "python"
}

function Invoke-CheckStep {
    param(
        [string]$Name,
        [scriptblock]$Step
    )

    Write-Host ""
    Write-Host "==> $Name"
    & $Step
    if ($LASTEXITCODE -ne 0) {
        throw "$Name failed with exit code $LASTEXITCODE"
    }
}

Set-Location $RepoRoot

Invoke-CheckStep "Backend tests" {
    & $Python -m pytest tests -q
}

Invoke-CheckStep "MCP tests" {
    & $Python -m pytest mcp_server/tests -q
}

Push-Location (Join-Path $RepoRoot "frontend")
try {
    Invoke-CheckStep "Frontend lint" {
        npm run lint
    }
    Invoke-CheckStep "Frontend typecheck" {
        npm run typecheck
    }
    Invoke-CheckStep "Frontend unit tests" {
        npm run test
    }
    Invoke-CheckStep "Frontend build" {
        npm run build
    }
    if ($IncludeE2E) {
        Invoke-CheckStep "Frontend Playwright E2E" {
            npm run e2e
        }
    }
}
finally {
    Pop-Location
}

Write-Host ""
Write-Host "All checks passed."
