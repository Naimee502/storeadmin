import { useCallback, useRef, useState } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import { useFocusEffect } from '@react-navigation/native';
import type { LatLng } from '../utils/geo';

export type LiveLocStatus = 'fetching' | 'live' | 'off';

async function ensurePermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  try {
    const res = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION, {
      title: 'Location permission',
      message: 'Your location is used to show the nearest party first.',
      buttonPositive: 'Allow',
    });
    return res === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

/**
 * Salesman's live position while the screen is focused.
 * - Fresh fix every time the screen comes into focus (back from a visit, app reopen).
 * - While focused, GPS is watched and a new position is published only after the
 *   salesman moves `distanceFilterM` metres, so lists re-sort as he walks
 *   without jittering on every GPS wobble.
 * - Watch stops on blur to save battery.
 */
export function useLiveLocation(distanceFilterM = 50) {
  const [loc, setLoc] = useState<LatLng | null>(null);
  const [status, setStatus] = useState<LiveLocStatus>('fetching');
  const watchId = useRef<number | null>(null);

  const onPos = useCallback((pos: any) => {
    setLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    setStatus('live');
  }, []);

  const stopWatch = useCallback(() => {
    if (watchId.current != null) {
      try { Geolocation.clearWatch(watchId.current); } catch {}
      watchId.current = null;
    }
  }, []);

  const start = useCallback(async () => {
    setStatus((s) => (s === 'live' ? s : 'fetching'));
    const ok = await ensurePermission();
    if (!ok) { setLoc(null); setStatus('off'); return; }
    // Quick fresh fix first so the list is right as soon as the screen opens.
    try {
      Geolocation.getCurrentPosition(
        onPos,
        () => setStatus((s) => (s === 'live' ? s : 'off')),
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 },
      );
    } catch { setStatus('off'); }
    stopWatch();
    try {
      watchId.current = Geolocation.watchPosition(
        onPos,
        () => {},
        { enableHighAccuracy: true, distanceFilter: distanceFilterM, interval: 10000, fastestInterval: 5000, maximumAge: 5000 } as any,
      ) as unknown as number;
    } catch {}
  }, [distanceFilterM, onPos, stopWatch]);

  useFocusEffect(
    useCallback(() => {
      start();
      return stopWatch;
    }, [start, stopWatch]),
  );

  return { loc, status, refresh: start };
}
