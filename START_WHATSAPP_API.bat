@echo off
echo ========================================
echo   Tabeebak WhatsApp API Server
echo ========================================
echo.

cd /d "%~dp0"

echo Checking Node.js installation...
node --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js is not installed!
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

echo Node.js version:
node --version
echo.

echo Checking dependencies...
if not exist "node_modules\" (
    echo Installing dependencies...
    call npm install
    echo.
)

echo Starting WhatsApp API Server (Enhanced Version)...
echo.
echo ========================================
echo   Server will start on port 3000
echo   QR Code: http://localhost:3000/api/bot/qr
echo ========================================
echo.

node server-enhanced.js

pause
