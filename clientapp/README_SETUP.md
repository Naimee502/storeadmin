# Store Admin - React Native App

A multi-flavor React Native application for store management with support for different roles (Party, Salesman, Delivery Boy, Staff) and two app variants: **RudraERP** and **RKN**.

---

## 📋 Table of Contents

- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Running the App](#running-the-app)
- [Running Specific Flavors](#running-specific-flavors)
- [Building Release APK](#building-release-apk)
- [Configuration](#configuration)
- [Troubleshooting](#troubleshooting)

---

## 📁 Project Structure

```
storeadmin/
├── clientapp/          # React Native app
│   ├── src/
│   │   ├── screens/    # App screens (public, protected, shared)
│   │   ├── components/ # Reusable components
│   │   ├── config/     # App configuration
│   │   ├── navigation/ # Navigation setup
│   │   ├── store/      # Redux store
│   │   └── utils/      # Helper utilities
│   ├── android/        # Android native code
│   ├── ios/            # iOS native code
│   └── App.tsx         # Root component
├── clientweb/          # Web admin panel
├── server/             # Backend GraphQL server
└── desktop/            # Desktop app
```

---

## ✅ Prerequisites

### System Requirements
- **Node.js**: v16 or higher
- **npm** or **yarn**: v6+
- **Java JDK**: 11 or higher (for Android)
- **Android SDK**: API level 31+ (for Android builds)
- **Xcode**: 13+ (for iOS)

### Installation Tools

```bash
# Install Node.js from: https://nodejs.org/
# Install Android Studio from: https://developer.android.com/studio

# Install React Native CLI globally (optional)
npm install -g react-native-cli
```

---

## 📦 Installation

### 1. Clone the Repository

```bash
cd /Users/naimeenariya/Desktop/Naimee/ReactNative/storeadmin/clientapp
```

### 2. Install Dependencies

```bash
npm install
# or
yarn install
```

### 3. Setup Android (for Android development)

```bash
# For physical device
adb reverse tcp:4000 tcp:4000  # If using local server

# Or for Android emulator (no reverse needed)
```

### 4. Verify Installation

```bash
npm start
```

This starts the Metro bundler. You should see:
```
Welcome to Metro!
...
Ready to accept connections
```

---

## 🚀 Running the App

### General Start (Both Flavors)

```bash
# Start Metro bundler
npm start

# In another terminal, run for Android (defaults to the RudraERP flavor)
npm run android
# or
yarn android
```

### Using Specific Flavors

#### 🏢 **RudraERP Flavor** (Default)

```bash
# Run debug build
npm run android:rudraerp

# Or using Gradle directly
cd clientapp/android
./gradlew app:installRudraerpDebug
```

#### 🏪 **RKN Flavor**

```bash
# Run debug build
npm run android:rkn

# Or using Gradle directly
cd clientapp/android
./gradlew app:installRknDebug
```

> **Only one flavor stays installed.** The two flavors have different
> applicationIds (`com.app.rudraerp` / `com.app.rkn`), so Android is happy to keep
> both on the device at once. The `npm run android:*` scripts uninstall the other
> flavor first, via `scripts/run-flavor.js`. Switching flavors therefore wipes that
> app's AsyncStorage and persisted Redux state, so you start unactivated and
> logged out. The `./gradlew app:install*` tasks skip that step and leave both
> installed.

### Running with Metro Directly

```bash
# Terminal 1: Start Metro bundler
npm start

# Terminal 2: Run specific flavor
npx react-native run-android --mode rudraerpDebug --appId com.app.rudraerp
# or
npx react-native run-android --mode rknDebug --appId com.app.rkn
```

---

## 🏗️ Building Release APK

### RudraERP Release Build

```bash
cd clientapp/android

# Build release APK
./gradlew app:assembleRudraerpRelease

# Output: app/build/outputs/apk/rudraerp/release/app-rudraerp-release.apk
```

### RKN Release Build

```bash
cd clientapp/android

# Build release APK
./gradlew app:assembleRknRelease

# Output: app/build/outputs/apk/rkn/release/app-rkn-release.apk
```

### Build AAB (for Google Play)

```bash
cd clientapp/android

# RudraERP
./gradlew app:bundleRudraerpRelease

# RKN
./gradlew app:bundleRknRelease

# Output: app/build/outputs/bundle/
```

---

## ⚙️ Configuration

### API Server Configuration

Edit `src/config/apiconfig.ts`:

```typescript
// Development (Debug builds)
const SERVER_URL = 'https://rudra.digisysindiatech.com';

// Production (Release builds)
const SERVER_URL_PROD = 'https://rudra.digisysindiatech.com';
```

#### Local Server Setup (Optional)

If you want to use a local server:

```typescript
// For USB-connected device
const SERVER_URL = 'http://localhost:4000';
// Then run: adb reverse tcp:4000 tcp:4000

// For Android emulator
const SERVER_URL = 'http://10.0.2.2:4000';

// For ngrok tunnel
const SERVER_URL = 'https://your-ngrok-url.ngrok.io';
// Sync with: npm run sync-ngrok
```

### Build Configuration

Each flavor has its own config file:
- `src/config/buildconfig.rudraerp.ts` - RudraERP specific config
- `src/config/buildconfig.rkn.ts` - RKN specific config
- `src/config/buildconfig.ts` - Auto-selected based on flavor

---

## 🐛 Troubleshooting

### Issue: "All flavors must now belong to a named flavor dimension"

**Solution:**
This error is fixed in the latest update. The `android/app/build.gradle` now includes:

```gradle
flavorDimensions "app"

productFlavors {
    rudraerp { dimension "app" }
    rkn { dimension "app" }
}
```

### Issue: App doesn't connect to server

**Check:**
1. Verify API URL in `src/config/apiconfig.ts`
2. For local server: Run `adb reverse tcp:4000 tcp:4000` (USB devices)
3. Check network connectivity
4. Review console logs: `npm start` shows Metro output

### Issue: "Introduction screen's Get Started button doesn't work"

**Solution:**
This is fixed in the latest update. The `finishIntro()` async function is now properly awaited in `src/screens/public/introduction/index.tsx`.

### Issue: Metro bundler keeps restarting

**Solution:**
```bash
# Clear cache and restart
npm start -- --reset-cache
```

### Issue: Gradle build fails

**Solution:**
```bash
cd clientapp/android

# Clean build
./gradlew clean
./gradlew app:assembleRudraerpDebug

# Or rebuild
./gradlew app:build --refresh-dependencies
```

### Issue: "Execution failed for task ':app:mergeDebugResources'"

**Solution:**
```bash
# Clear Android build cache
cd clientapp/android
rm -rf .gradle
rm -rf app/build
./gradlew clean build
```

---

## 📱 App Roles

The app supports different user roles with dedicated screens:

- **🏢 Party**: Customer/Party management
- **💼 Salesman**: Sales and order management
- 🚚 **Delivery Boy**: Delivery tracking and collections
- 👔 **Staff**: Staff management and tasks

---

## 🔄 Development Workflow

### 1. Start Development

```bash
# Terminal 1: Metro bundler
npm start

# Terminal 2: Run app (with hot reload)
npm run android:rudraerp
```

### 2. Make Changes

Edit files in `src/` - Hot reload will automatically update the app.

### 3. Test Both Flavors

```bash
# Test RudraERP
npm run android:rudraerp

# Test RKN
npm run android:rkn
```

### 4. Before Pushing Code

```bash
# Clear cache
npm start -- --reset-cache

# Test build
./gradlew app:assembleRudraerpDebug
```

---

## 📚 Key Technologies

- **Framework**: React Native
- **State Management**: Redux + Redux Persist
- **API**: GraphQL with Apollo Client
- **Navigation**: React Navigation v5
- **UI Components**: Custom + React Native
- **Animations**: React Native Reanimated 2
- **Database**: AsyncStorage
- **Firebase**: Firebase Cloud Messaging, In-App Updates

---

## 📞 Support

For issues or questions:

1. Check the [Troubleshooting](#troubleshooting) section
2. Review console logs: `npm start`
3. Check Android Studio logcat for native errors
4. Review GraphQL errors in Apollo DevTools

---

## 📄 License

Proprietary - All rights reserved

---

## 🎯 Quick Commands Reference

```bash
# Setup
npm install

# Development
npm start                                      # Start Metro
npm run android:rudraerp                       # Run RudraERP
npm run android:rkn                            # Run RKN

# Build
./gradlew app:assembleRudraerpRelease        # Build RudraERP APK
./gradlew app:assembleRknRelease             # Build RKN APK
./gradlew app:bundleRudraerpRelease          # Build RudraERP AAB

# Clean & Rebuild
./gradlew clean
npm start -- --reset-cache

# Reset everything
npm install
npm start -- --reset-cache
```

---

**Last Updated**: September 2026  
**Version**: 1.0.0
