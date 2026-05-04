# Building Android APK

This guide explains how to build an Android APK from the LocalAI project using EAS Build.

## Prerequisites

Before building an APK, ensure you have:

1. **Node.js 18+** installed
2. **Expo account** (create one at https://expo.dev)
3. **EAS CLI** installed globally
4. **Android development environment** (optional, for local builds)

## Setup

### 1. Install EAS CLI

```bash
npm install -g eas-cli
```

### 2. Login to Expo

```bash
eas login
```

Enter your Expo credentials when prompted.

### 3. Configure the Project

The project already includes an `eas.json` configuration file with three build profiles:

- **development**: Debug build with development client
- **preview**: Internal testing build
- **production**: Production-ready build for distribution

## Building an APK

### Option 1: Cloud Build (Recommended)

EAS Build runs on Expo's servers and requires no local Android setup.

#### Preview Build (for testing)

```bash
eas build --platform android --profile preview
```

#### Production Build

```bash
eas build --platform android --profile production
```

The build process will:
1. Upload your code to EAS servers
2. Install dependencies
3. Build the APK
4. Provide a download link when complete

### Option 2: Local Build

For local builds, you need Android Studio and the Android SDK installed.

```bash
eas build --platform android --profile preview --local
```

## Build Configuration

The `eas.json` file defines build configurations:

```json
{
  "build": {
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "android": {
        "buildType": "apk"
      }
    }
  }
}
```

### Build Types

- **apk**: Universal APK that works on all Android devices (larger file size)
- **aab**: Android App Bundle for Google Play Store (smaller, optimized per device)

## App Configuration

The app is configured in `app.json`:

```json
{
  "expo": {
    "name": "LocalAI",
    "slug": "local-ai-app",
    "version": "1.0.0",
    "android": {
      "package": "com.localai.app",
      "versionCode": 1,
      "permissions": [
        "android.permission.INTERNET",
        "android.permission.READ_EXTERNAL_STORAGE",
        "android.permission.WRITE_EXTERNAL_STORAGE",
        "android.permission.ACCESS_NETWORK_STATE",
        "android.permission.CAMERA",
        "android.permission.RECORD_AUDIO"
      ]
    }
  }
}
```

### Required Permissions

- **INTERNET**: Connect to Ollama servers and HuggingFace
- **READ/WRITE_EXTERNAL_STORAGE**: Download and store models
- **ACCESS_NETWORK_STATE**: Check network connectivity
- **CAMERA**: (Optional) For future vision features
- **RECORD_AUDIO**: For voice input features

## Environment Variables

Before building, ensure your `.env` file is configured:

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
```

**Note**: Environment variables are embedded in the APK at build time.

## Installing the APK

### On Physical Device

1. Download the APK from the EAS build page
2. Transfer to your Android device
3. Enable "Install from unknown sources" in Android settings
4. Open the APK file and follow installation prompts

### On Emulator

```bash
adb install path/to/your-app.apk
```

## Signing the APK

EAS automatically handles signing for cloud builds. For custom signing:

### Generate Keystore

```bash
keytool -genkeypair -v -keystore my-release-key.keystore -alias my-key-alias \
  -keyalg RSA -keysize 2048 -validity 10000
```

### Configure EAS

```bash
eas credentials
```

Follow the prompts to upload your keystore.

## Build Size Optimization

To reduce APK size:

1. **Remove unused dependencies**:
```bash
npm prune
```

2. **Enable ProGuard** (add to `app.json`):
```json
{
  "android": {
    "enableProguard": true,
    "enableShrinkResources": true
  }
}
```

3. **Use AAB format** for Play Store:
```bash
eas build --platform android --profile production
```
Then change `buildType` to `aab` in `eas.json`.

## Troubleshooting

### Build Fails with "Out of Memory"

Increase build memory in `eas.json`:
```json
{
  "build": {
    "production": {
      "android": {
        "gradleCommand": ":app:bundleRelease",
        "buildType": "apk"
      },
      "node": "18.x",
      "env": {
        "NODE_OPTIONS": "--max-old-space-size=4096"
      }
    }
  }
}
```

### Build Succeeds but APK Won't Install

- Check minimum Android version (targetSdkVersion in app.json)
- Ensure all required permissions are declared
- Verify package name doesn't conflict with existing apps

### Assets Not Loading

Make sure all required assets exist:
```bash
ls assets/images/icon.png
ls assets/images/adaptive-icon.png
ls assets/images/splash.png
```

## Publishing to Google Play Store

### 1. Switch to AAB Format

Update `eas.json`:
```json
{
  "build": {
    "production": {
      "android": {
        "buildType": "aab"
      }
    }
  }
}
```

### 2. Build for Production

```bash
eas build --platform android --profile production
```

### 3. Submit to Play Store

```bash
eas submit --platform android
```

Or manually upload the AAB file to the Google Play Console.

## Automated Builds

### GitHub Actions

Create `.github/workflows/build.yml`:

```yaml
name: Build APK

on:
  push:
    tags:
      - 'v*'

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: npm ci
      - run: npx eas-cli build --platform android --profile production --non-interactive
        env:
          EXPO_TOKEN: ${{ secrets.EXPO_TOKEN }}
```

### Required Secrets

Add to GitHub repository settings:
- `EXPO_TOKEN`: Generate at https://expo.dev/accounts/[username]/settings/access-tokens

## Testing the APK

### Recommended Testing Checklist

- [ ] App launches without crashes
- [ ] All tabs are accessible
- [ ] Ollama connection works (if server available)
- [ ] Models can be browsed and downloaded
- [ ] Chat functionality works
- [ ] Agents can be created and configured
- [ ] Extensions can be installed
- [ ] Settings persist after restart
- [ ] Dark mode toggle works
- [ ] Network changes are handled gracefully
- [ ] App runs on different Android versions (8.0+)
- [ ] App runs on different screen sizes

## Version Management

Update version in `app.json`:

```json
{
  "version": "1.0.0",
  "android": {
    "versionCode": 1
  }
}
```

- **version**: User-facing version string (1.0.0, 1.1.0, etc.)
- **versionCode**: Integer that must increase with each release

## Resources

- [Expo EAS Build Documentation](https://docs.expo.dev/build/introduction/)
- [Android Developer Guide](https://developer.android.com/guide)
- [Google Play Console](https://play.google.com/console)

## Support

For issues or questions:
- Check [Expo Forums](https://forums.expo.dev/)
- Open an issue on GitHub
- Review [EAS Build Status](https://status.expo.dev/)

---

**Note**: This project is set up for APK builds. For iOS builds, additional configuration and an Apple Developer account are required.
