// Per-device offline mode switch; off unless this browser turned it on.
const KEY = "offline:enabled";

export function isOfflineEnabled(): boolean {
  try {
    return localStorage.getItem(KEY) === "true";
  } catch {
    return false;
  }
}

export function setOfflineEnabled(on: boolean): void {
  try {
    if (on) localStorage.setItem(KEY, "true");
    else localStorage.removeItem(KEY);
  } catch {
    // Storage blocked: the setting simply stays off.
  }
}
