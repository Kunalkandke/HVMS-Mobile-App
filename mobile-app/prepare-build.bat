@echo off
echo.
echo 🚀 Preparing HVMS Mobile App for Build...
echo.

cd /d "%~dp0"

echo 📦 Step 1: Cleaning old dependencies...
if exist node_modules rmdir /s /q node_modules
if exist package-lock.json del /f /q package-lock.json

echo 📥 Step 2: Installing dependencies...
call npm install

echo ✅ Step 3: Verifying installation...
if exist node_modules (
    echo ✓ Dependencies installed successfully
) else (
    echo ✗ Failed to install dependencies
    exit /b 1
)

echo.
echo ✅ Build preparation complete!
echo.
echo Next steps:
echo 1. Make sure you're logged in to Expo: eas login
echo 2. Build APK: npm run build:android
echo    OR for local build: npm run build:android:local
echo.
pause
