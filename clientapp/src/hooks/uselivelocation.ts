import { useCallback, useRef, useState } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import { useFocusEffect } from '@react-navigation/native';
import { rememberFix, getRecentFix, type LatLng } from '../utils/geo';

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
    setLoc(rememberFix(pos));
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
    // A fix taken in the last 3 min (e.g. on the previous screen) shows the
    // list straight away instead of a blank "No GPS" state.
    const recent = getRecentFix();
    if (recent) { setLoc(recent); setStatus('live'); }
    // Quick fresh fix first so the list is right as soon as the screen opens.
    // GPS can't get a satellite fix inside shops / basements, so on failure
    // fall back to network / Wi-Fi location instead of giving up.
    const lowAccuracyFallback = () => {
      try {
        Geolocation.getCurrentPosition(
          onPos,
          () => setStatus((s) => (s === 'live' ? s : 'off')),
          { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 },
        );
      } catch { setStatus((s) => (s === 'live' ? s : 'off')); }
    };
    try {
      Geolocation.getCurrentPosition(
        onPos,
        lowAccuracyFallback,
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 },
      );
    } catch { lowAccuracyFallback(); }
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
