// Screen helpers for offline billing; every hook returns today's values when offline mode is off.
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { isOfflineEnabled } from "./settings";
import { offlineStore, type OfflineSnapshot } from "./outbox";
import { getDeviceCode, peekDeviceNumber } from "./device";
import { pendingPartyDelta, pendingStockDelta } from "./overlay";
import { isOfflineSaved } from "./saved";
import type { DocType } from "./core";

export function useOfflineSnapshot(): OfflineSnapshot {
  return useSyncExternalStore(offlineStore.subscribe, offlineStore.getSnapshot);
}

// True when offline mode is on and this browser has no network.
export function useNoNetwork(): boolean {
  const snap = useOfflineSnapshot();
  return isOfflineEnabled() && !snap.online;
}

/**
 * Next device number to show and send while offline mode is on and there is no network.
 * number is null online or when off; noDevice is true when the device has no code yet.
 */
export function useOfflineNumber(type: DocType, active = true): { number: string | null; noDevice: boolean } {
  const snap = useOfflineSnapshot();
  const offline = isOfflineEnabled() && active && !snap.online;
  const [number, setNumber] = useState<string | null>(null);
  const [noDevice, setNoDevice] = useState(false);
  useEffect(() => {
    if (!offline) {
      setNumber(null);
      setNoDevice(false);
      return;
    }
    let live = true;
    void peekDeviceNumber(type)
      .catch(() => null)
      .then((n) => {
        if (!live) return;
        setNumber(n);
        setNoDevice(!n && !getDeviceCode());
      });
    return () => {
      live = false;
    };
  }, [offline, type, snap.items]);
  return { number, noDevice };
}

// One-line note shown when the device has no number series yet.
export function OfflineNumberNote({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <div className="text-[12px] text-amber-700">Offline: the number will be given when this syncs.</div>
  );
}

const idOf = (v: any): string => (!v ? "" : typeof v === "string" ? v : String(v.id ?? v._id ?? ""));

// Product list with each variant's currentstock plus unsynced stock moves; same array when nothing changes.
export function adjustProductsStock(list: any[], branchId: string | null | undefined, items: OfflineSnapshot["items"]): any[] {
  if (!Array.isArray(list) || !list.length || !items.length) return list;
  let changed = false;
  const out = list.map((p: any) => {
    const variants = p?.productvariants;
    if (!Array.isArray(variants) || !variants.length) return p;
    let touched = false;
    const next = variants.map((v: any) => {
      const d = pendingStockDelta(idOf(p), idOf(v), branchId || null, { variant: v, items });
      if (!d) return v;
      touched = true;
      return { ...v, currentstock: Number(v.currentstock ?? 0) + d };
    });
    if (!touched) return p;
    changed = true;
    return { ...p, productvariants: next };
  });
  return changed ? out : list;
}

// Stock overlay for screens that show or check stock; returns the input untouched when offline mode is off.
export function useOfflineStock(list: any[], branchId: string | null | undefined): any[] {
  const snap = useOfflineSnapshot();
  const on = isOfflineEnabled();
  return useMemo(() => (on ? adjustProductsStock(list, branchId, snap.items) : list), [on, list, branchId, snap.items]);
}

// Unsynced change to a party's outstanding (0 when offline mode is off).
export function useOfflinePartyDelta(partyId: string | null | undefined): number {
  const snap = useOfflineSnapshot();
  if (!isOfflineEnabled() || !partyId) return 0;
  return pendingPartyDelta(partyId, { items: snap.items });
}

export const OFFLINE_SAVED_TEXT = "Saved offline — will sync automatically";

// True when a save was queued on this device (offline id, or offline mode with no network).
export function savedOffline(doc: any): boolean {
  if (isOfflineSaved(doc)) return true;
  return isOfflineEnabled() && typeof navigator !== "undefined" && navigator.onLine === false;
}
