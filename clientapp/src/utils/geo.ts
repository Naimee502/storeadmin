import { PermissionsAndroid, Platform } from 'react-native';
import Geolocation from '@react-native-community/geolocation';

export type LatLng = { lat: number; lng: number };

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

/** Current GPS fix (asks for permission on Android). Resolves null if unavailable. */
export async function getCurrentLatLng(opts: { fresh?: boolean; timeoutMs?: number } = {}): Promise<LatLng | null> {
  if (Platform.OS === 'android') {
    try {
      const res = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION, {
        title: 'Location permission',
        message: 'Your location is needed to record visits and orders at the party.',
        buttonPositive: 'Allow',
      });
      if (res !== PermissionsAndroid.RESULTS.GRANTED) return null;
    } catch {
      return null;
    }
  }
  return new Promise((resolve) => {
    try {
      Geolocation.getCurrentPosition(
        (pos: any) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: opts.timeoutMs ?? 15000, maximumAge: opts.fresh ? 0 : 30000 },
      );
    } catch {
      resolve(null);
    }
  });
}

/** Local (device) calendar day as YYYY-MM-DD — toISOString() is UTC and gives yesterday before 05:30 IST. */
export const localYMD = (d: Date = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
