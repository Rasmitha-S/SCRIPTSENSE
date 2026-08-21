Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "          Starting ScriptSense Development         " -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Cyan

$rootDir = $PSScriptRoot
$backendDir = Join-Path $rootDir "backend"
$frontendDir = Join-Path $rootDir "frontend"

# Launch Backend
Write-Host "[1/2] Starting FastAPI Backend on http://127.0.0.1:8000 ..." -ForegroundColor Yellow
$backendPython = Join-Path $backendDir "venv\Scripts\python.exe"
if (Test-Path $backendPython) {
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$backendDir'; & '$backendPython' -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload"
} else {
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$backendDir'; python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload"
}

# Launch Frontend
Write-Host "[2/2] Starting Vite Frontend on http://localhost:5173 ..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$frontendDir'; npm run dev -- --host 0.0.0.0 --port 5173"

Start-Sleep -Seconds 3

Write-Host "===================================================" -ForegroundColor Green
Write-Host "[SUCCESS] Both services launched!" -ForegroundColor Green
Write-Host "  Frontend:     http://localhost:5173" -ForegroundColor White
Write-Host "  Backend API:  http://127.0.0.1:8000/docs" -ForegroundColor White
Write-Host "===================================================" -ForegroundColor Green

Start-Process "http://localhost:5173"
Start-Process "http://127.0.0.1:8000/docs"
