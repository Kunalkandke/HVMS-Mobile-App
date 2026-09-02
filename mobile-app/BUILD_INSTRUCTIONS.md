# HVMS Mobile App - Build Instructions

## Prerequisites

Before building the APK, ensure you have:

1. **Node.js** (v18 or higher) - [Download](https://nodejs.org/)
2. **npm** (comes with Node.js)
3. **Expo CLI** - Install globally: `npm install -g expo-cli`
4. **EAS CLI** - Install globally: `npm install -g eas-cli`
5. **Expo Account** - Sign up at [expo.dev](https://expo.dev/)

## Quick Build (Cloud Build)

### Step 1: Prepare the Project

**Windows:**
```bash
cd mobile-app
prepare-build.bat
```

**Mac/Linux:**
```bash
cd mobile-app
chmod +x prepare-build.sh
./prepare-build.sh
```

**Or manually:**
```bash
cd mobile-app
rm -rf node_modules
npm install
```

### Step 2: Login to Expo

```bash
eas login
```

Enter your Expo credentials.

### Step 3: Build APK

```bash
npm run build:android
```

Or directly:
```bash
eas build --platform android --profile preview
```

### Step 4: Download APK

Once the build completes:
1. You'll get a download link in the terminal
2. Or visit: https://expo.dev/accounts/[your-username]/projects/hvms-mobile/builds
3. Download the APK file
4. Transfer to your Android device and install

## Local Build (No Queue Wait)

If you want to build locally without waiting in queue:

### Additional Prerequisites for Local Build:
- **Android Studio** with Android SDK
- **JDK 17** or higher

### Build Command:
```bash
npm run build:android:local
```

Or:
```bash
eas build --platform android --profile preview --local
```

## Configuration

### Backend API URL

Before building for production, update the API URL in:
`src/services/api.js`

```javascript
const PROD_API_URL = 'https://your-backend-url.com/api/v1';
```

### App Version

Update version in `app.json`:
```json
{
  "expo": {
    "version": "1.0.0",
    "android": {
      "versionCode": 1
    }
  }
}
```

Increment `versionCode` for each new build.

## Troubleshooting

### Build Fails with "Unknown error"
- Check build logs at the provided URL
- Ensure all dependencies are installed: `npm install`
- Clear cache: `expo start --clear`

### "Waiting in Free tier queue"
- Use local build: `npm run build:android:local`
- Or upgrade to Expo paid plan
- Or wait for the queue (can take 10-30 minutes)

### "Cannot find module" errors
```bash
cd mobile-app
rm -rf node_modules package-lock.json
npm install
```

### Keystore Issues
- EAS will generate a keystore automatically on first build
- Keep your keystore safe for future updates

## Build Profiles

### Preview (APK for testing)
```bash
eas build --platform android --profile preview
```
- Generates APK file
- For internal testing
- Can be installed directly on devices

### Production (For Play Store)
```bash
eas build --platform android --profile production
```
- Generates AAB file
- For Google Play Store submission
- Requires Play Store account

## After Build

1. **Download APK** from the provided link
2. **Transfer to Android device** via USB, email, or cloud storage
3. **Enable "Install from Unknown Sources"** in Android settings
4. **Install the APK**
5. **Test thoroughly** before distributing

## Support

For issues:
- Check Expo docs: https://docs.expo.dev/
- EAS Build docs: https://docs.expo.dev/build/introduction/
- Expo forums: https://forums.expo.dev/
