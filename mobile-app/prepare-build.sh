#!/bin/bash

echo "🚀 Preparing HVMS Mobile App for Build..."
echo ""

# Navigate to mobile-app directory
cd "$(dirname "$0")"

echo "📦 Step 1: Cleaning old dependencies..."
rm -rf node_modules
rm -f package-lock.json

echo "📥 Step 2: Installing dependencies..."
npm install

echo "✅ Step 3: Verifying installation..."
if [ -d "node_modules" ]; then
    echo "✓ Dependencies installed successfully"
else
    echo "✗ Failed to install dependencies"
    exit 1
fi

echo ""
echo "✅ Build preparation complete!"
echo ""
echo "Next steps:"
echo "1. Make sure you're logged in to Expo: eas login"
echo "2. Build APK: npm run build:android"
echo "   OR for local build: npm run build:android:local"
echo ""
