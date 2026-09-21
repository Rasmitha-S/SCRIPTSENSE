@echo off
setlocal enabledelayedexpansion
title ScriptSense Full-Stack TypeScript Launcher

echo ===================================================
echo     Starting ScriptSense (Full-Stack TypeScript)
echo ===================================================

echo [1/2] Starting Unified Dev Environment (Backend + Frontend)...
start "ScriptSense Dev Servers" cmd /k "title ScriptSense Dev Servers && npm run dev"

echo.
echo ===================================================
echo [SUCCESS] ScriptSense services launched!
echo.
echo   Frontend App:   http://localhost:5173
echo   Backend API:    http://localhost:8000
echo   Health Check:   http://localhost:8000/api/health
echo ===================================================
echo.
echo Opening browser to http://localhost:5173 in 3 seconds...
ping -n 3 127.0.0.1 >nul
start http://localhost:5173
