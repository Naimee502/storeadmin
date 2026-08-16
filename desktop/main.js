// ---------------------------------------------------------------------------
// Rudra Admin — Electron desktop shell.
//
// WHY THIS EXISTS
// The admin panel is a normal web app, and a browser tab genuinely cannot
// protect itself from screen capture: no browser exposes "am I being
// screen-shared" to the page, on purpose. (The `isScreenCaptured` proposal is
// still only a proposal, and its own design doc plans to allowlist it to
// financial institutions.) So in a browser all we can do is watermark.
//
// A desktop window CAN be protected, and that is this shell's entire job.
// BrowserWindow.setContentProtection(true):
//   Windows — calls SetWindowDisplayAffinity(WDA_EXCLUDEFROMCAPTURE). On
//             Windows 10 v2004 and newer the window is removed from any
//             capture entirely. Older Windows falls back to WDA_MONITOR,
//             which captures a black window. Either way: no readable frame.
//   macOS   — sets NSWindow.sharingType = NSWindowSharingNone. Note Apple
//             deliberately changed this: newer capture apps built on
//             ScreenCaptureKit CAN still record the window. So macOS is
//             weaker, and we do not pretend otherwise anywhere in the UI.
//
// The protection is driven by the SAME Business Settings flag as the
// watermark, not hardcoded here — the owner still has to be able to demo the
// product. The renderer reads the flag from GraphQL and calls through
// preload.js, so one setting controls both surfaces.
// ---------------------------------------------------------------------------

const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('node:path');

// Where the admin panel lives. Point this at the deployed panel; for local
// development run `npm run dev` in ../client and set ADMIN_URL to that.
const ADMIN_URL = process.env.ADMIN_URL || 'https://rudra.digisysindiatech.com/admin';

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    show: false,
    backgroundColor: '#ffffff',
    title: 'Rudra Admin',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      // The renderer is a full web app that we do not want holding Node
      // powers — a single XSS would otherwise become local code execution.
      // Everything it legitimately needs is exposed through preload.js.
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // Avoid the white flash while the panel boots.
  mainWindow.once('ready-to-show', () => mainWindow.show());

  mainWindow.loadURL(ADMIN_URL);

  // External links (support site, docs, storefront preview) belong in the
  // user's real browser, not in a chrome-less Electron window they can't
  // navigate out of.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Renderer → main. Returns what actually happened so the panel can tell the
// user the truth instead of assuming success.
ipcMain.handle('security:set-content-protection', (_event, enabled) => {
  if (!mainWindow) return { applied: false, reason: 'no-window' };
  try {
    mainWindow.setContentProtection(!!enabled);
    return {
      applied: true,
      enabled: !!enabled,
      platform: process.platform,
      // Be explicit that macOS protection can be defeated by ScreenCaptureKit
      // recorders, so the UI never claims more than it delivers.
      fullyEnforced: process.platform === 'win32',
    };
  } catch (err) {
    return { applied: false, reason: String(err && err.message) };
  }
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
