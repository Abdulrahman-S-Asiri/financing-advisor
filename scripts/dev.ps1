param(
    [int]$MockPort = 8100,
    [int]$ApiPort = 8000,
    [int]$FrontendPort = 3000
)

$ErrorActionPreference = "Stop"
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$Python = Join-Path $RepoRoot ".venv\Scripts\python.exe"
if (-not (Test-Path $Python)) {
    $Python = "python"
}

$LogDir = Join-Path ([System.IO.Path]::GetTempPath()) "athar-dev"
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

function Start-AtharProcess {
    param(
        [string]$Name,
        [string]$FilePath,
        [string[]]$Arguments,
        [string]$WorkingDirectory
    )

    $OutLog = Join-Path $LogDir "$Name.out.log"
    $ErrLog = Join-Path $LogDir "$Name.err.log"
    $Process = Start-Process `
        -FilePath $FilePath `
        -ArgumentList $Arguments `
        -WorkingDirectory $WorkingDirectory `
        -WindowStyle Hidden `
        -RedirectStandardOutput $OutLog `
        -RedirectStandardError $ErrLog `
        -PassThru

    [pscustomobject]@{
        Name = $Name
        Id = $Process.Id
        OutLog = $OutLog
        ErrLog = $ErrLog
    }
}

$Processes = @()
$Processes += Start-AtharProcess `
    -Name "mock-open-banking" `
    -FilePath $Python `
    -Arguments @("-m", "uvicorn", "mock_open_banking.main:app", "--port", "$MockPort") `
    -WorkingDirectory $RepoRoot

$Processes += Start-AtharProcess `
    -Name "api" `
    -FilePath $Python `
    -Arguments @("-m", "uvicorn", "api.main:app", "--port", "$ApiPort") `
    -WorkingDirectory $RepoRoot

$Processes += Start-AtharProcess `
    -Name "frontend" `
    -FilePath "npm.cmd" `
    -Arguments @("run", "dev", "--", "-p", "$FrontendPort") `
    -WorkingDirectory (Join-Path $RepoRoot "frontend")

Write-Host "ATHAR services started."
Write-Host "Frontend:          http://127.0.0.1:$FrontendPort"
Write-Host "API docs:          http://127.0.0.1:$ApiPort/docs"
Write-Host "Mock banking docs: http://127.0.0.1:$MockPort/docs"
Write-Host "Logs:              $LogDir"
Write-Host ""
$Processes | Format-Table -AutoSize
Write-Host "Stop later with: Stop-Process -Id <Id>"
