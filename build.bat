@echo off
echo ===================================================
echo   Building ScriptSense Full-Stack TypeScript App
echo ===================================================

echo [1/2] Compiling TypeScript Backend and Frontend Bundle...
cd /d "%~dp0"
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Build failed!
    exit /b %ERRORLEVEL%
)

echo [2/2] Running Backend Integration Test Suite...
call npm test
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Integration tests failed!
    exit /b %ERRORLEVEL%
)

echo ===================================================
echo [SUCCESS] ScriptSense built and verified successfully!
echo ===================================================
