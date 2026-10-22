import { PermissionsAndroid, Platform } from 'react-native';
import Geolocation from '@react-native-community/geolocation';

/** acc = GPS accuracy radius in metres, ts = when the fix was taken (ms). */
export type LatLng = { lat: number; lng: number; acc?: number; ts?: number };

/** Straight-line distance in metres. */
export function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export const partyHasLocation = (p: any) =>
  p && p.latitude != null && p.longitude != null && !(Number(p.latitude) === 0 && Number(p.longitude) === 0);

/**
 * GPS drift allowance used by the geo-fence. Indoors a fix can sit 30-80 m off
 * the real spot, so the reported accuracy is taken off the distance — capped,
 * so a very poor (km-wide) fix can never pass the fence on its own.
 * Keep in sync with GEO_ACC_CAP_M on the server (utils/fieldreport).
 */
export const GEO_ACC_CAP_M = 100;
export const isWithinFence = (distanceM: number, accM: number | null | undefined, radiusM: number) =>
  distanceM - Math.min(Math.max(Number(accM) || 0, 0), GEO_ACC_CAP_M) <= radiusM;

// Last good fix from anywhere in the app (live watch on My Routes / My Parties,
// or a one-shot fix). Used as the final fallback when a fresh fix cannot be
// had inside a shop / basement.
let lastFix: LatLng | null = null;
const LAST_FIX_MAX_AGE_MS = 3 * 60 * 1000;

const toFix = (pos: any): LatLng => ({
  lat: pos.coords.latitude,
  lng: pos.coords.longitude,
  acc: typeof pos.coords.accuracy === 'number' ? pos.coords.accuracy : undefined,
  ts: typeof pos.timestamp === 'number' ? pos.timestamp : Date.now(),
});

/** Record a fix (from a watch or one-shot) so later callers can fall back to it. */
export function rememberFix(posOrFix: any): LatLng {
  const f: LatLng = posOrFix?.coords ? toFix(posOrFix) : posOrFix;
  if (!lastFix || (f.ts ?? 0) >= (lastFix.ts ?? 0)) lastFix = { ...f, ts: f.ts ?? Date.now() };
  return f;
}

export function getRecentFix(maxAgeMs = LAST_FIX_MAX_AGE_MS): LatLng | null {
  if (!lastFix) return null;
  return Date.now() - (lastFix.ts ?? 0) <= maxAgeMs ? lastFix : null;
}

export async function ensureLocationPermission(message?: string): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  try {
    const res = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION, {
      title: 'Location permission',
      message: message || 'Your location is needed to record visits and orders at the party.',
      buttonPositive: 'Allow',
    });
    return res === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

const onePosition = (highAccuracy: boolean, timeoutMs: number, maximumAge: number) =>
  new Promise<LatLng | null>((resolve) => {
    try {
      Geolocation.getCurrentPosition(
        (pos: any) => resolve(rememberFix(pos)),
        () => resolve(null),
        { enableHighAccuracy: highAccuracy, timeout: timeoutMs, maximumAge },
      );
    } catch {
      resolve(null);
    }
  });

/**
 * Current position with fallbacks, so a weak satellite signal inside a shop
 * doesn't leave the salesman stuck:
 *   1. GPS (high accuracy)
 *   2. network / Wi-Fi location (low accuracy) — works indoors
 *   3. last good fix seen in the app within the past 3 min
 * Resolves null only when all three fail (GPS off / permission denied).
 *
 * fresh    — skip cached OS fixes in step 1 (still falls back in steps 2-3)
 * maxAccM  — reject fixes worse than this (e.g. when SAVING a party location)
 * noCache  — don't use step 3
 */
export async function getCurrentLatLng(
  opts: { fresh?: boolean; timeoutMs?: number; maxAccM?: number; noCache?: boolean } = {},
): Promise<LatLng | null> {
  if (!(await ensureLocationPermission())) return null;
  const okAcc = (f: LatLng | null) =>
    !!f && (opts.maxAccM == null || f.acc == null || f.acc <= opts.maxAccM);
  const t = opts.timeoutMs ?? 10000;

  const high = await onePosition(true, t, opts.fresh ? 0 : 30000);
  if (okAcc(high)) return high;

  const low = await onePosition(false, Math.min(t, 8000), 60000);
  if (okAcc(low)) return low;

  if (!opts.noCache) {
    const recent = getRecentFix();
    if (okAcc(recent)) return recent;
  }
  return null;
}

/** Local (device) calendar day as YYYY-MM-DD — toISOString() is UTC and gives yesterday before 05:30 IST. */
export const localYMD = (d: Date = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
