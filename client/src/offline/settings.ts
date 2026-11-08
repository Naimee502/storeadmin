// Offline billing switch: the business setting, which this device can override (on / off / follow).
import { store } from "../redux/store";

export type DeviceMode = "on" | "off" | "follow";

const KEY = "offline:device";
// Earlier per-device opt-in; read as "on".
const OLD_KEY = "offline:enabled";

const listeners = new Set<() => void>();

function readMode(): DeviceMode {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "on" || v === "off") return v;
    return localStorage.getItem(OLD_KEY) === "true" ? "on" : "follow";
  } catch {
    return "follow";
  }
}

// Cached: it is read on every Redux action and every GraphQL operation.
let mode = readMode();
export const getDeviceMode = (): DeviceMode => mode;

const isBusinessOfflineOn = (): boolean => (store.getState() as any)?.adminsettings?.settings?.offlineBilling === true;

const modeOn = (m: DeviceMode): boolean => m === "on" || (m === "follow" && isBusinessOfflineOn());

// True when offline billing is active on this device right now.
export const isOfflineEnabled = (): boolean => modeOn(getDeviceMode());

let last = isOfflineEnabled();
const emit = () => {
  last = isOfflineEnabled();
  listeners.forEach((l) => l());
};

export function setDeviceMode(next: DeviceMode): void {
  try {
    if (next === "follow") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, next);
    localStorage.removeItem(OLD_KEY);
  } catch {
    // Storage blocked: kept for this page only.
  }
  mode = next;
  emit();
}

// Another tab changed the switch.
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key !== KEY && e.key !== OLD_KEY) return;
    mode = readMode();
    emit();
  });
}

store.subscribe(() => {
  if (isOfflineEnabled() !== last) emit();
});

// Fires when the device mode or the effective on/off state changes.
export const modeStore = {
  subscribe(l: () => void) {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  },
  getSnapshot: getDeviceMode,
};
