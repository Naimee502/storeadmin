# Client App

## Flavours

| Flavour     | App Name               | Package Name                    | Admin Code | Version |
|-------------|------------------------|---------------------------------|------------|---------|
| `rkn`       | DK                     | `com.app.rkn`                   | #ADM0001   | 1 (1.0) |
| `arsi`      | Arsi Agarbatti         | `com.arsi.agarbatti`            | #ADM0002   | 2 (2.0) |
| `rudraerp`  | Rudra ERP              | `com.app.rudraerp`              | #ADM0003   | 2 (2.0) |
| `powergold` | Powergold Agro Product | `com.app.powergoldagroproduct`  | #ADM0004   | 1 (1.0) |

## Run

```sh
npm start
npm run android:rkn
npm run android:arsi
npm run android:rudraerp
npm run android:powergold
```

## Build (APK)

```sh
npm run build:rkn
npm run build:arsi
npm run build:rudraerp
npm run build:powergold
```

Output: `android/app/build/outputs/apk/<flavour>/release/`

## Bundle (AAB for Play Store)

```sh
npm run bundle:rkn
npm run bundle:arsi
npm run bundle:rudraerp
npm run bundle:powergold
```

Output: `android/app/build/outputs/bundle/<flavour>Release/`
