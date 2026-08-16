# Rudra Admin — Desktop Shell

The one place where screen-capture protection for the admin panel is **actually enforced** rather than merely deterred.

## Why it exists

A browser tab cannot protect itself from screen capture. No browser tells a page that it is being screen-shared or recorded — that is a deliberate privacy decision, not an oversight. The `isScreenCaptured` proposal exists but is still only a proposal, and its own design document plans to gate it behind an allowlist for financial institutions.

So in a browser, Business Settings → Screen Capture Protection → *Admin panel* can only draw the tiled watermark: it makes a leaked recording **traceable** (whose login, what time), not impossible.

This shell closes that gap on the desktop. It loads the same admin panel and calls `BrowserWindow.setContentProtection(true)`:

| Platform | Effect |
|---|---|
| **Windows 10 v2004+** | `SetWindowDisplayAffinity(WDA_EXCLUDEFROMCAPTURE)` — the window is removed from any capture entirely. |
| **Older Windows** | Falls back to `WDA_MONITOR` — capture gets a black window. |
| **macOS** | `NSWindow.sharingType = NSWindowSharingNone`. ⚠️ Apple intentionally changed this: recorders built on **ScreenCaptureKit can still capture the window**. Treat macOS as partial. |

## How the setting reaches it

One flag drives both surfaces, so there is nothing to keep in sync:

```
Business Settings → secureScreenAdmin  (server: AdminSettings)
        ↓ GraphQL
client/src/components/screenwatermark   → draws the watermark
        ↓ window.desktopSecurity        (preload.js, only present here)
desktop/main.js                         → setContentProtection(true|false)
```

It is a setting and not a hardcoded `true` on purpose — the owner still has to be able to record their own demo. Turning it off genuinely restores capture.

## Running it

```bash
cd desktop
npm install

# against the deployed panel
npm start

# against a local dev server (client/ running on :5173)
npm run dev

# or point it anywhere
ADMIN_URL=https://your-domain.com/admin npm start
```

## Packaging

```bash
npm run build:win    # NSIS installer
npm run build:mac    # dmg
```

Set `ADMIN_URL` in `main.js` to your real deployed panel before packaging — the env var is for development.

## Security notes

`contextIsolation` and `sandbox` are both on and `nodeIntegration` is off, so the renderer has no Node access. `preload.js` exposes exactly one capability (toggling content protection) and nothing else. Keep it that way: anything added there becomes reachable from every page the panel loads.

External links are pushed to the system browser via `setWindowOpenHandler`, so users can't get stranded in a chrome-less window.

## What this does not solve

Someone can still point a phone at the monitor. That is what the watermark is for — it survives a photograph, and names who was logged in.
