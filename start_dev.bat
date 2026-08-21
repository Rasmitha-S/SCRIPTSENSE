@echo off
setlocal enabledelayedexpansion
title ScriptSense Development Launcher

echo ===================================================
echo           Starting ScriptSense Development
echo ===================================================

set ROOT_DIR=%~dp0
set BACKEND_DIR=%ROOT_DIR%backend
set FRONTEND_DIR=%ROOT_DIR%frontend

:: 1. Verify and Launch Backend
echo [1/2] Launching FastAPI Backend on http://127.0.0.1:8000 ...
if exist "%BACKEND_DIR%\venv\Scripts\python.exe" (
    start "ScriptSense Backend (FastAPI)" cmd /k "title ScriptSense Backend && cd /d "%BACKEND_DIR%" && venv\Scripts\python.exe -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload"
) else (
    echo [WARNING] Python venv not found at backend\venv. Using system Python...
    start "ScriptSense Backend (FastAPI)" cmd /k "title ScriptSense Backend && cd /d "%BACKEND_DIR%" && python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload"
)

:: 2. Launch Frontend
echo [2/2] Launching Vite Frontend on http://localhost:5173 ...
start "ScriptSense Frontend (Vite)" cmd /k "title ScriptSense Frontend && cd /d "%FRONTEND_DIR%" && npm run dev -- --host 0.0.0.0 --port 5173"

echo.
echo ===================================================
echo [SUCCESS] Both services launched in separate windows!
echo.
echo   Frontend App:   http://localhost:5173
echo   Backend Docs:   http://127.0.0.1:8000/docs
echo   Backend Root:   http://127.0.0.1:8000/
echo ===================================================
echo.
echo Opening browser to http://localhost:5173 in 3 seconds...
timeout /t 3 /nobreak >nul
start http://localhost:5173
start http://127.0.0.1:8000/docs
