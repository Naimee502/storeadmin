import { useEffect, useRef } from 'react';
import { AppState, PermissionsAndroid, Platform } from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import DeviceInfo from 'react-native-device-info';
import { useMutation, useQuery } from '@apollo/client/react';
import { useSelector } from 'react-redux';
import { ADD_LOCATION_PINGS } from '../apollo/mutations/tracking';
import { GET_OPEN_PUNCH } from '../apollo/queries/attendance';
import type { RootState } from '../store/rootreducer';

/**
 * Smart field tracking (Zoho-style), instead of a fix every 45 seconds:
 *
 *   • MOVEMENT-BASED — the OS reports a point only after the phone has moved
 *     MOVE_DISTANCE_M (25 m, so turns show on the trail). Sitting in a shop for an hour costs no GPS fixes and
 *     no duplicate rows; driving gives a clean route line.
 *   • HEARTBEAT — while standing still, one low-power fix every
 *     HEARTBEAT_MS, so the admin still sees "here, as of 10 min ago".
 *   • BATCHED UPLOAD — points are queued and sent together every FLUSH_MS (or
 *     when FLUSH_SIZE pile up / the app goes to background / punch-out), so the
 *     radio wakes a few times an hour, not every ping. Failed sends are kept
 *     and retried.
 *   • Poor fixes (accuracy worse than MAX_ACCURACY_M) are dropped — they are
 *     what made the map zig-zag and the KM jump.
 *
 * Runs only after PUNCH IN, stops at PUNCH OUT, and only while the app is open.
 */
// A point every ~25 m of movement (was 100 m), so the drawn trail follows the
// actual turns instead of cutting corners between far-apart points. Uploads
// are still batched, so this costs GPS fixes, not extra network calls.
const MOVE_DISTANCE_M = 25;
const HEARTBEAT_MS = 10 * 60 * 1000;
const FLUSH_MS = 3 * 60 * 1000;
const FLUSH_SIZE = 25;
// Moving fixes must be good (≤ 50 m) — with points this close together a
// sloppy fix would zig-zag the line and inflate the KM. The low-power
// stand-still heartbeat keeps the old, looser limit.
const MAX_ACCURACY_M = 50;
const HEARTBEAT_MAX_ACCURACY_M = 150;
// How often we re-check punch state so tracking stops soon after punch-out.
const PUNCH_POLL_MS = 2 * 60 * 1000;

// Local calendar day (toISOString() is UTC — a 00:00–05:30 IST ping would
// land on yesterday).
const localYMD = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function useLocationTracker() {
  const user = useSelector((s: RootState) => s.auth.user);
  const role = (user?.role || '').toLowerCase();
  const trackable = role === 'salesman' || role === 'deliveryboy';

  const [addPings] = useMutation(ADD_LOCATION_PINGS);

  // Poll the open punch so we notice punch-in / punch-out without a manual refetch.
  const { data: punchData } = useQuery(GET_OPEN_PUNCH, {
    variables: { staffid: user?.id },
    skip: !user?.id || !trackable,
    fetchPolicy: 'cache-and-network',
    pollInterval: PUNCH_POLL_MS,
  });
  const punchedIn = !!(punchData as any)?.getOpenPunch;

  const grantedRef = useRef(false);
  const queue = useRef<any[]>([]);
  const lastPingAt = useRef(0);
  const battery = useRef<number | undefined>(undefined);

  useEffect(() => {
    // Track only when a trackable user is punched IN.
    if (!user?.id || !user?.adminId || !trackable || !punchedIn) return;

    let cancelled = false;
    let watchId: number | null = null;
    let heartbeat: ReturnType<typeof setInterval> | null = null;
    let flusher: ReturnType<typeof setInterval> | null = null;

    const ensurePermission = async (): Promise<boolean> => {
      if (grantedRef.current) return true;
      if (Platform.OS === 'android') {
        const res = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Location permission',
            message: 'Your location is used to show your route and visits in reports.',
            buttonPositive: 'Allow',
          },
        );
        grantedRef.current = res === PermissionsAndroid.RESULTS.GRANTED;
        return grantedRef.current;
      }
      grantedRef.current = true;
      return true;
    };

    const flush = () => {
      if (!queue.current.length) return;
      const batch = queue.current.splice(0, queue.current.length);
      addPings({ variables: { inputs: batch } }).catch((e: any) => {
        // Keep them for the next try (bounded, oldest dropped first).
        queue.current = [...batch, ...queue.current].slice(-200);
        console.warn('[tracker] upload failed, will retry:', e?.message);
      });
    };

    const readBattery = () =>
      DeviceInfo.getBatteryLevel()
        .then((l) => { if (l != null && l >= 0) battery.current = Math.round(l * 100); })
        .catch(() => {});

    const record = (pos: any, maxAccuracy: number = MAX_ACCURACY_M) => {
      if (cancelled || !pos?.coords) return;
      readBattery();
      const { latitude, longitude, accuracy, speed } = pos.coords;
      if (accuracy != null && accuracy > maxAccuracy) return;
      const at = new Date(pos.timestamp || Date.now());
      lastPingAt.current = at.getTime();
      queue.current.push({
        adminid: user.adminId,
        staffid: user.id,
        role,
        latitude,
        longitude,
        accuracy,
        speed: speed != null && speed >= 0 ? speed : undefined,
        // Battery % at this point (refreshed on every fix / heartbeat).
        battery: battery.current,
        pingdate: localYMD(at),
        pingedAt: at.toISOString(),
      });
      if (queue.current.length >= FLUSH_SIZE) flush();
    };

    const start = async () => {
      if (watchId != null || cancelled) return;
      const ok = await ensurePermission();
      if (!ok || cancelled) return;
      await readBattery();

      // First point right away (punch-in / app opened).
      Geolocation.getCurrentPosition((p: any) => record(p, HEARTBEAT_MAX_ACCURACY_M), () => {}, { enableHighAccuracy: true, timeout: 20000, maximumAge: 60000 });

      watchId = Geolocation.watchPosition((p: any) => record(p), (err: any) => console.warn('[tracker] watch error:', err?.message), {
        enableHighAccuracy: true,
        distanceFilter: MOVE_DISTANCE_M,
        // Android: ask for a fix every 10 s (5 s at most) — the 25 m filter
        // still drops the ones where he has not moved.
        interval: 10000,
        fastestInterval: 5000,
        maximumAge: 5000,
      } as any);

      heartbeat = setInterval(() => {
        if (Date.now() - lastPingAt.current < HEARTBEAT_MS) return; // moved recently
        Geolocation.getCurrentPosition((p: any) => record(p, HEARTBEAT_MAX_ACCURACY_M), () => {}, { enableHighAccuracy: false, timeout: 20000, maximumAge: 120000 });
      }, HEARTBEAT_MS);

      flusher = setInterval(flush, FLUSH_MS);
    };

    const stop = () => {
      if (watchId != null) {
        Geolocation.clearWatch(watchId);
        watchId = null;
      }
      if (heartbeat) clearInterval(heartbeat);
      if (flusher) clearInterval(flusher);
      heartbeat = null;
      flusher = null;
      flush(); // don't sit on points while the app is closed
    };

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') start();
      else stop();
    });

    if (AppState.currentState === 'active') start();

    return () => {
      cancelled = true;
      sub.remove();
      stop();
    };
  }, [punchedIn, user?.id, user?.adminId, trackable, role, addPings]);
}
