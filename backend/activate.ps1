# Activate DataPilot Backend Virtual Environment
$venvPath = Join-Path $PSScriptRoot "venv\Scripts\Activate.ps1"
if (Test-Path $venvPath) {
    & $venvPath
    Write-Host "DataPilot Backend virtual environment (venv) activated." -ForegroundColor Green
} else {
    Write-Host "Virtual environment not found. Run 'python run.py' to auto-create it." -ForegroundColor Yellow
}
