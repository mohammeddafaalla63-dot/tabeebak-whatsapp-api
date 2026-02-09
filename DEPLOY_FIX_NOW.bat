@echo off
echo ========================================
echo   Deploy WhatsApp NoAuth Fix
echo ========================================
echo.

echo This will deploy the fix to Render.
echo.
echo What changed:
echo - Switched from LocalAuth to NoAuth
echo - Removes session persistence issues
echo - Should connect reliably now
echo.

pause

echo.
echo Adding files...
git add bot-noauth.js server-enhanced.js

echo.
echo Committing...
git commit -m "Fix WhatsApp connection with NoAuth strategy"

echo.
echo Pushing to GitHub...
git push origin main

echo.
echo ========================================
echo   Deployment Triggered!
echo ========================================
echo.
echo Render is now rebuilding your service.
echo This takes about 3-5 minutes.
echo.
echo What to do next:
echo.
echo 1. Go to: https://dashboard.render.com
echo 2. Click your service
echo 3. Watch "Events" tab for "Deploy succeeded"
echo 4. Open Logs tab
echo 5. Go to: https://your-service.onrender.com/api/bot/qr
echo 6. Scan QR code
echo 7. Watch logs for "WhatsApp Bot is ready and connected!"
echo.
echo Expected timeline:
echo - 0:00 Scan QR code
echo - 0:10 Authentication successful
echo - 0:30 Loading messages
echo - 1:00 Bot ready!
echo.

pause
