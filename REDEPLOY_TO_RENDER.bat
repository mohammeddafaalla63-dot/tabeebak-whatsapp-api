@echo off
echo ========================================
echo   Redeploy WhatsApp API to Render
echo ========================================
echo.

echo This will trigger a new deployment on Render.
echo.
echo Steps:
echo 1. Make sure all changes are saved
echo 2. Commit changes to Git
echo 3. Push to GitHub
echo 4. Render will auto-deploy
echo.

pause

echo.
echo Checking Git status...
git status

echo.
echo Adding all changes...
git add .

echo.
echo Committing changes...
set /p commit_msg="Enter commit message (or press Enter for default): "
if "%commit_msg%"=="" set commit_msg="Update WhatsApp bot with better logging and error handling"
git commit -m "%commit_msg%"

echo.
echo Pushing to GitHub...
git push origin main

echo.
echo ========================================
echo   Deployment Triggered!
echo ========================================
echo.
echo Render will now rebuild and deploy your service.
echo This takes about 3-5 minutes.
echo.
echo Check deployment status:
echo https://dashboard.render.com
echo.
echo After deployment completes:
echo 1. Go to: https://your-service.onrender.com/api/bot/qr
echo 2. Scan the QR code
echo 3. Check logs for connection status
echo.

pause
