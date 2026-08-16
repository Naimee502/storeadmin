// ---------------------------------------------------------------------------
// The only bridge between the admin panel and the desktop shell.
//
// contextIsolation is on and sandbox is on, so the renderer has no Node access
// at all. This file hands it exactly one capability — toggling capture
// protection — and nothing else. Adding anything here widens the attack
// surface of every page the panel ever loads, so keep it to what is needed.
//
// The panel feature-detects `window.desktopSecurity`: present means "running
// in the desktop app, real protection available", absent means "browser tab,
// watermark only". See client/src/components/screenwatermark/index.tsx.
// ---------------------------------------------------------------------------

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktopSecurity', {
  /**
   * Turn OS-level capture protection on or off for this window.
   * Resolves with { applied, enabled, platform, fullyEnforced }.
   * `fullyEnforced` is true only on Windows — macOS lets ScreenCaptureKit
   * recorders through, and the caller should not claim otherwise.
   */
  setContentProtection: (enabled) =>
    ipcRenderer.invoke('security:set-content-protection', !!enabled),

  /** Lets the panel show "Desktop app" vs "Browser" in the settings screen. */
  isDesktopApp: true,
});
