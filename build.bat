@echo off
echo ===================================================
echo       Building ScriptSense - Frontend and Backend
echo ===================================================

echo [1/3] Checking Python Virtual Environment...
if exist "%~dp0backend\venv\Scripts\python.exe" (
    echo Python venv found at backend\venv.
) else (
    echo [WARNING] Python venv not found at backend\venv. Creating venv...
    python -m venv "%~dp0backend\venv"
    "%~dp0backend\venv\Scripts\pip.exe" install -r "%~dp0backend\requirements.txt"
)

echo [2/3] Building Frontend Production Bundle...
cd /d "%~dp0frontend"
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Frontend build failed!
    exit /b %ERRORLEVEL%
)

echo [3/3] Running Backend Verification Tests...
cd /d "%~dp0backend"
"%~dp0backend\venv\Scripts\python.exe" test_integration_inproc.py
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] In-process integration tests failed!
    exit /b %ERRORLEVEL%
)

echo ===================================================
echo [SUCCESS] ScriptSense built and verified successfully!
echo ===================================================
