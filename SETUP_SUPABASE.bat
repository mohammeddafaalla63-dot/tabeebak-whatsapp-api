@echo off
color 0E
echo ========================================
echo   Supabase Setup for WhatsApp API
echo ========================================
echo.

echo This script will help you configure Supabase.
echo.

echo Step 1: Get your Supabase key
echo --------------------------------
echo 1. Go to: https://app.supabase.com/
echo 2. Select your project
echo 3. Click Settings (gear icon)
echo 4. Click API
echo 5. Copy the "anon public" key
echo.
pause

echo.
echo Step 2: Enter your Supabase key
echo --------------------------------
set /p SUPABASE_KEY="Paste your Supabase anon key here: "

echo.
echo Updating .env file...

(
echo # Supabase Configuration
echo SUPABASE_URL=https://eltymdmtpkgyipqdfxur.supabase.co
echo SUPABASE_KEY=%SUPABASE_KEY%
echo.
echo # Server Configuration
echo PORT=3000
echo NODE_ENV=development
echo.
echo # WhatsApp Configuration
echo COUNTRY_CODE=249
echo.
echo # URLs
echo API_URL=http://localhost:3000
echo WEBSITE_URL=http://localhost:3001
echo.
echo # Keep-Alive
echo KEEP_ALIVE_INTERVAL=600000
) > .env

echo.
echo ✅ .env file updated!
echo.

echo Step 3: Create database table
echo --------------------------------
echo.
echo Now you need to create the magic_links table in Supabase:
echo.
echo 1. Go to: https://app.supabase.com/
echo 2. Select your project
echo 3. Click "SQL Editor"
echo 4. Click "New Query"
echo 5. Copy and paste this SQL:
echo.
echo CREATE TABLE IF NOT EXISTS magic_links (
echo   id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
echo   phone_number TEXT NOT NULL,
echo   token TEXT NOT NULL UNIQUE,
echo   expires_at TIMESTAMPTZ NOT NULL,
echo   used BOOLEAN DEFAULT FALSE,
echo   used_at TIMESTAMPTZ,
echo   created_at TIMESTAMPTZ DEFAULT NOW()
echo );
echo.
echo CREATE INDEX IF NOT EXISTS idx_magic_links_token ON magic_links(token);
echo CREATE INDEX IF NOT EXISTS idx_magic_links_phone ON magic_links(phone_number);
echo.
echo 6. Click "Run"
echo.
pause

echo.
echo Step 4: Start the server
echo --------------------------------
echo.
echo Starting WhatsApp API server...
echo.

npm start

pause
