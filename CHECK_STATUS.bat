@echo off
echo ========================================
echo   WhatsApp Bot Status Checker
echo ========================================
echo.

set /p service_url="Enter your Render service URL (e.g., https://tabeebak-whatsapp-api.onrender.com): "

if "%service_url%"=="" (
    echo Error: Service URL is required!
    pause
    exit /b
)

echo.
echo Checking service health...
echo.
curl -s %service_url%/health
echo.
echo.

echo ========================================
echo   Bot Status
echo ========================================
echo.
curl -s %service_url%/api/bot/status
echo.
echo.

echo ========================================
echo   Quick Links
echo ========================================
echo.
echo QR Code Page:
echo %service_url%/api/bot/qr
echo.
echo Service Dashboard:
echo https://dashboard.render.com
echo.
echo.

echo ========================================
echo   What the Status Means
echo ========================================
echo.
echo "isReady": true  = Bot is connected ✅
echo "isReady": false = Bot is NOT connected ❌
echo "hasQR": true    = QR code is available
echo "hasQR": false   = No QR code (already connected or initializing)
echo.

pause
