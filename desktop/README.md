# Desktop App

Rudra Admin ka desktop app. Ye admin panel ko window mein kholta hai aur screen capture protection deta hai.

## Run

```sh
npm install
npm start
npm run dev
```

- `npm start`: live admin panel (`https://rudra.digisysindiatech.com/admin`)
- `npm run dev`: local client (`client/`, port 5173)

## Build

Pehle ek baar:

```sh
cd desktop
rm -rf node_modules
npm install
```

Mac par dmg:

```sh
npm run build:mac
```

Output: `dist/Rudra Admin-1.0.0-arm64.dmg`

Mac par Windows exe:

```sh
npm run build:win
```

Output: `dist/Rudra Admin Setup 1.0.0.exe`

Windows PC par exe:

```sh
npm run build:win
```

Windows par bhi same command, output same folder mein.

## Install

- **Mac:** dmg kholo, **Rudra Admin** ko **Applications** mein drag karo. Pehli baar right-click → **Open**.
- **Windows:** installer (`.exe`) chalao.

Mac par "damaged" error aaye toh:

```sh
xattr -cr "/Applications/Rudra Admin.app"
```

## Notes

- Installer dobara banane ki zaroorat tabhi hai jab `main.js` ya `preload.js` badle hon. Client ya server ke changes ke liye sirf deploy karna kaafi hai.
- `dist/` git mein nahi jaata.
- Mac ka dmg notarized nahi hai, isliye pehli baar Open karna padta hai.
