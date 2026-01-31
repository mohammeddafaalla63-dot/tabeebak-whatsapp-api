@echo off
color 0B
echo ========================================
echo   Configuration Checker
echo ========================================
echo.

echo Checking .env file...
if exist .env (
    echo ✅ .env file exists
    echo.
    echo Contents:
    type .env
    echo.
) else (
    echo ❌ .env file NOT found!
    echo Please create it or run SETUP_SUPABASE.bat
    pause
    exit /b 1
)

echo.
echo ========================================
echo   Checking Supabase Key
echo ========================================

findstr /C:"SUPABASE_KEY=eyJ" .env >nul
if %errorlevel%==0 (
    echo ✅ Supabase key looks valid (starts with eyJ)
) else (
    echo ❌ Supabase key looks invalid or missing
    echo Please run SETUP_SUPABASE.bat to fix
)

echo.
echo ========================================
echo   Checking Dependencies
echo ========================================

if exist node_modules (
    echo ✅ node_modules folder exists
) else (
    echo ❌ node_modules NOT found
    echo Run: npm install
)

echo.
echo ========================================
echo   Testing Server Connection
echo ========================================

echo Checking if server is running...
curl -s http://localhost:3000/health >nul 2>&1
if %errorlevel%==0 (
    echo ✅ Server is running!
    echo.
    curl http://localhost:3000/health
) else (
    echo ❌ Server is NOT running
    echo Start it with: npm start
)

echo.
echo ========================================
echo   Summary
echo ========================================
echo.
echo If all checks pass (✅), you're ready to test!
echo If any checks fail (❌), fix them first.
echo.
pause
