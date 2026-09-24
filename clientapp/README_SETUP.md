# Store Admin - React Native App

A multi-flavor React Native application for store management with support for different roles (Party, Salesman, Delivery Boy, Staff) and three app variants (flavors): **RudraERP**, **RKN** and **Powergold Agro**.

| Flavor | npm script | Package name | Admin code | Business |
|---|---|---|---|---|
| `rudraerp` | `npm run android:rudraerp` | `com.app.rudraerp` | `#ADM0003` | Rudra Enterprise |
| `rkn` | `npm run android:rkn` | `com.app.rkn` | `#ADM0001` | DK Marketing |
| `powergold` | `npm run android:powergold` | `com.app.powergoldagroproduct` | `#ADM0004` | Powergold Agro Product |

---

## 📋 Table of Contents

- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Running Locally (local server + admin panel)](#-running-locally-local-server--admin-panel)
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

## 🖥️ Running Locally (local server + admin panel)

Everything is currently pointed at the **local** server (`http://localhost:4000`):

| Part | Where the URL lives | Local value | Live value |
|---|---|---|---|
| App (debug builds) | `clientapp/src/config/apiconfig.ts` → `SERVER_URL` | `http://localhost:4000` | `https://rudra.digisysindiatech.com` |
| Admin panel (client) | `client/src/config/apiconfig.ts` → `SERVER_URL` / `SERVER_URL_PROD` | `http://localhost:4000` | `https://rudra.digisysindiatech.com` |
| Website (clientweb) | `clientweb/src/config/apiconfig.ts` → `SERVER_URL` / `SERVER_URL_PROD` | `http://localhost:4000` | `https://rudra.digisysindiatech.com` |
| Server (image URLs) | `server/src/config/serverconfig.ts` | `http://localhost:4000` | `https://rudra.digisysindiatech.com` |

Automatic: app debug / `npm run dev` → local; app release / `npm run build` / `npm start` / pm2 → live.

```bash
# Terminal 1 — MongoDB must be running (server/.env → mongodb://127.0.0.1:27017/pos_billing_erp)
brew services start mongodb-community     # or however Mongo is installed

# Terminal 2 — backend on :4000
cd server
npm install
npm run dev

# Terminal 3 — admin panel on http://localhost:5173
cd client
npm install
npm run dev

# Terminal 4 — Metro
cd clientapp
npm start

# Terminal 5 — the app (pick a flavor)
cd clientapp
npm run android:powergold
```

`npm run android:<flavor>` runs `adb reverse tcp:4000 tcp:4000` and `adb reverse tcp:8081 tcp:8081`
for you, so a USB phone or emulator reaches the Mac's server and Metro. If you re-plug the phone
without re-running the script, run those two commands by hand.

> **The local database is separate from live.** The app activates itself with its flavor's admin code
> (e.g. `#ADM0004`). That admin must exist in the **local** database, otherwise the app shows
> "Business code #ADM0004 not found". Create it from the local admin panel (Manage Admins) first,
> or restore a copy of the live data into local Mongo.

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

#### 🌾 **Powergold Agro Flavor** (`#ADM0004`)

```bash
# Run debug build
npm run android:powergold

# Or using Gradle directly
cd clientapp/android
./gradlew app:installPowergoldDebug
```

> **Only one flavor stays installed.** The two flavors have different
> applicationIds (`com.app.rudraerp` / `com.app.rkn` / `com.app.powergoldagroproduct`), so Android is happy to keep
> them all on the device at once. The `npm run android:*` scripts uninstall the other
> flavors first, via `scripts/run-flavor.js`. Switching flavors therefore wipes that
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
# or
npx react-native run-android --mode powergoldDebug --appId com.app.powergoldagroproduct
```

(Running this way skips the `adb reverse` step — run `adb reverse tcp:4000 tcp:4000` yourself when using the local server.)

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

### Powergold Agro Release Build

```bash
cd clientapp/android

# Build release APK
./gradlew app:assemblePowergoldRelease

# Output: app/build/outputs/apk/powergold/release/app-powergold-release.apk
```

### Build AAB (for Google Play)

```bash
cd clientapp/android

# RudraERP
./gradlew app:bundleRudraerpRelease

# RKN
./gradlew app:bundleRknRelease

# Powergold Agro
./gradlew app:bundlePowergoldRelease

# Output: app/build/outputs/bundle/
```

---

## ⚙️ Configuration

### API Server Configuration

Edit `src/config/apiconfig.ts`:

```typescript
// Development (Debug builds) — currently local
const SERVER_URL = 'http://localhost:4000';

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

### Adding a New Flavor (how Powergold was added)

1. `android/app/build.gradle` — add it to `productFlavors` (with its `applicationId`), to
   `debuggableVariants` (`<name>Debug`, `<name>DebugOptimized`), and to `preBuildTask`
   (`flavor.contains('<name>')` → `buildconfig.<name>.ts`).
2. `src/config/buildconfig.<name>.ts` — the admin code.
3. `android/app/src/<name>/res/values/strings.xml` — `app_name` and `admin_code`.
4. Firebase console (project `rudra-erp-26fe7`) → Add app → Android with the new applicationId, then
   re-download the ONE common `android/app/google-services.json` (it lists every app) and replace it.
   There are no per-flavor google-services.json files — without the new package in the common file
   the Gradle build fails with "No matching client found".
5. Launcher icons — `android/app/src/<name>/res/mipmap-*/` (without them the default icons in `main/` are used).
6. `scripts/run-flavor.js` (`FLAVORS`) and `package.json` (`android:<name>` script).

#### ⚠️ Powergold — still to do before release

- **Firebase:** the app is added in Firebase. Re-download the common `android/app/google-services.json`
  (it must list `com.app.powergoldagroproduct`), then delete the temporary placeholder
  `android/app/src/powergold/google-services.json`.
- **Icons:** no Powergold launcher icons yet — add them under `android/app/src/powergold/res/mipmap-*`
  (Android Studio → New → Image Asset, with the Powergold flavor source set).

### Build Configuration

Each flavor has its own config file:
- `src/config/buildconfig.rudraerp.ts` - RudraERP specific config
- `src/config/buildconfig.rkn.ts` - RKN specific config
- `src/config/buildconfig.powergold.ts` - Powergold Agro specific config (`#ADM0004`)
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
    powergold { dimension "app" }
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
npm run android:powergold                      # Run Powergold Agro

# Build
./gradlew app:assembleRudraerpRelease        # Build RudraERP APK
./gradlew app:assembleRknRelease             # Build RKN APK
./gradlew app:assemblePowergoldRelease       # Build Powergold APK
./gradlew app:bundleRudraerpRelease          # Build RudraERP AAB

# install release build on devices

adb install -r /Users/naimeenariya/Desktop/Naimee/ReactNative/storeadmin/clientapp/android/app/build/outputs/apk/rudraerp/release/app-rudraerp-release.apk

adb install -r /Users/naimeenariya/Desktop/Naimee/ReactNative/storeadmin/clientapp/android/app/build/outputs/apk/rkn/release/app-rkn-release.apk

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
