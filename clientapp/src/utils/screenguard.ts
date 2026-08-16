import { NativeModules, Platform } from 'react-native';

/**
 * JS face of the native ScreenGuard module.
 *
 * ── What "on" actually means, per platform ──────────────────────────────────
 * Android  Real. FLAG_SECURE makes the OS refuse to place this window into a
 *          screenshot, screen recording or screen-share — it hands out black
 *          instead. Nothing in JS can defeat it.
 * iOS      Best effort. Apple ships no FLAG_SECURE equivalent. The native side
 *          watches UIScreen.isCaptured and covers the app in black while a
 *          recording / mirroring session is live. A single still screenshot
 *          cannot be blocked, only detected afterwards.
 *
 * Business Settings says exactly this, so nobody thinks iOS is airtight.
 *
 * Every call is safe to make unconditionally: if the native module is missing
 * (old build that predates it, or a fresh JS bundle on a stale binary) these
 * become no-ops rather than throwing and taking a screen down with them.
 */

type ScreenGuardNative = {
  setSecure(enabled: boolean): Promise<boolean>;
  isFullyEnforced?: () => boolean;
};

const native: ScreenGuardNative | undefined = (NativeModules as any)?.ScreenGuard;

/** True only where the OS itself enforces the block (Android today). */
export const isScreenGuardFullyEnforced = (): boolean => {
  if (!native) return false;
  if (Platform.OS === 'android') return true;
  return false;
};

/** True when a native module is present at all — i.e. the binary is new enough. */
export const isScreenGuardAvailable = (): boolean => !!native;

/**
 * Turn capture protection on or off.
 *
 * Both directions matter: turning the Business Setting OFF has to genuinely
 * restore capture, otherwise the owner can't record their own demo — which is
 * the whole reason this is a setting and not a hardcoded flag.
 */
export const setScreenSecure = async (enabled: boolean): Promise<boolean> => {
  if (!native?.setSecure) return false;
  try {
    return await native.setSecure(!!enabled);
  } catch {
    // Never let a window-flag failure crash a screen. Worst case the app is
    // capturable, which is exactly where it was before this feature existed.
    return false;
  }
};
