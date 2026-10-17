# Client App

## Flavours

| Flavour     | App Name               | Package Name                    | Admin Code | Version |
|-------------|------------------------|---------------------------------|------------|---------|
| `rkn`       | DK                     | `com.app.rkn`                   | #ADM0001   | 1 (1.0) |
| `arsi`      | Arsi Agarbatti         | `com.arsi.agarbatti`            | #ADM0002   | 2 (2.0) |
| `rudraerp`  | Rudra ERP              | `com.app.rudraerp`              | #ADM0003   | 2 (2.0) |
| `powergold` | Powergold Agro Product | `com.app.powergoldagroproduct`  | #ADM0004   | 1 (1.0) |
| `pelican`   | Pelican                | `com.app.pelican`               | #ADM0005   | 1 (1.0) |

## Run

```sh
npm start
npm run android:rkn
npm run android:arsi
npm run android:rudraerp
npm run android:powergold
npm run android:pelican
```

## Build (APK)

```sh
npm run build:rkn
npm run build:arsi
npm run build:rudraerp
npm run build:powergold
npm run build:pelican
```

Output: `android/app/build/outputs/apk/<flavour>/release/`

## Bundle (AAB for Play Store)

```sh
npm run bundle:rkn
npm run bundle:arsi
npm run bundle:rudraerp
npm run bundle:powergold
npm run bundle:pelican
```

Output: `android/app/build/outputs/bundle/<flavour>Release/`

## Signing keys & SHA-1 (Firebase)

| Flavour     | Keystore (`android/app/`) | Alias          |
|-------------|---------------------------|----------------|
| `rkn`       | `rudraerp.keystore`       | `rudraerp`     |
| `rudraerp`  | `rudraerp.keystore`       | `rudraerp`     |
| `powergold` | `rudraerp.keystore`       | `rudraerp`     |
| `pelican`   | `rudraerp.keystore`       | `rudraerp`     |
| `arsi`      | `arsiagarbatti.jks`       | `arsiagarbatti`|

Fingerprints to add in Firebase → Project settings → the Android app → **Add fingerprint**
(every app on `rudraerp.keystore` uses the same values):

| Key | SHA-1 | SHA-256 |
|-----|-------|---------|
| Release (`rudraerp.keystore`) | `8D:98:F4:CC:7D:39:A3:78:7D:9F:F0:44:57:F7:C2:1B:15:1F:0A:85` | `38:9A:5B:BC:E1:F4:95:C8:03:BA:63:5D:CA:CB:5E:E6:90:21:78:5B:16:0A:B9:CB:FB:E5:46:C0:71:6E:95:D5` |
| Debug (`debug.keystore`) | `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25` | `FA:C6:17:45:DC:09:03:78:6F:B9:ED:E6:2A:96:2B:39:9F:73:48:F0:BB:6F:89:9B:83:32:66:75:91:03:3B:9C` |

Once the app is on Play with **Play App Signing**, also add the **App signing key** SHA-1/SHA-256
from Play Console → Test and release → App integrity — installs from the Play Store are signed
with that key, not the upload key above.

Print them again any time:

```sh
cd android/app
keytool -list -v -keystore rudraerp.keystore -alias rudraerp      # asks for the store password (gradle.properties)
keytool -list -v -keystore debug.keystore -alias androiddebugkey -storepass android
```

## Adding a new flavour (checklist)

1. `android/app/build.gradle` — add it to `productFlavors`, to `debuggableVariants`, and to the `activeFlavor` list.
2. `android/app/src/<flavour>/res/` — `values/strings.xml` (`app_name`, `admin_code`), launcher icons (`mipmap-*`) and `ic_notification` (`drawable-*`).
3. `src/config/buildconfig.<flavour>.ts` — the business's admin code.
4. `scripts/run-flavor.js` and `package.json` — `android:` / `build:` / `bundle:` scripts.
5. Firebase — add an Android app with the new package name, add the SHA-1/SHA-256 above, download `google-services.json` and replace `android/app/google-services.json` (it holds every flavour's app; the build fails if the package is missing from it).
6. This README.
