Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "   Starting ScriptSense (Full-Stack TypeScript)    " -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Cyan

$rootDir = $PSScriptRoot

# Launch Unified Development Environment
Write-Host "[1/1] Starting TypeScript Backend and React Frontend..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$rootDir'; npm run dev"

Start-Sleep -Seconds 3

Write-Host "===================================================" -ForegroundColor Green
Write-Host "[SUCCESS] Both services launched!" -ForegroundColor Green
Write-Host "  Frontend:     http://localhost:5173" -ForegroundColor White
Write-Host "  Backend API:  http://localhost:8000" -ForegroundColor White
Write-Host "  Health Check: http://localhost:8000/api/health" -ForegroundColor White
Write-Host "===================================================" -ForegroundColor Green

Start-Process "http://localhost:5173"
