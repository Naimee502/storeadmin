import { useEffect, useRef } from 'react';
import { AppState, PermissionsAndroid, Platform } from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import { useMutation, useQuery } from '@apollo/client/react';
import { useSelector } from 'react-redux';
import { ADD_LOCATION_PINGS } from '../apollo/mutations/tracking';
import { GET_OPEN_PUNCH } from '../apollo/queries/attendance';
import type { RootState } from '../store/rootreducer';

// Foreground GPS ping cadence (only while punched in + app active).
const PING_INTERVAL_MS = 45000;
// How often we re-check punch state so tracking stops soon after punch-out.
const PUNCH_POLL_MS = 30000;

/**
 * Location tracker for salesman / delivery boy, gated by attendance:
 *   • Starts pinging after PUNCH IN (an open punch exists).
 *   • Stops pinging on PUNCH OUT (no open punch).
 * Also only runs while the app is in the foreground. Pings feed the admin
 * field reports' live-location view.
 */
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

  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const grantedRef = useRef(false);

  useEffect(() => {
    // Track only when a trackable user is punched IN.
    if (!user?.id || !user?.adminId || !trackable || !punchedIn) return;

    let cancelled = false;

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

    const sendPing = () => {
      Geolocation.getCurrentPosition(
        (pos: any) => {
          if (cancelled) return;
          const now = new Date();
          addPings({
            variables: {
              inputs: [
                {
                  adminid: user.adminId,
                  staffid: user.id,
                  role,
                  latitude: pos.coords.latitude,
                  longitude: pos.coords.longitude,
                  accuracy: pos.coords.accuracy,
                  speed: pos.coords.speed ?? undefined,
                  pingdate: now.toISOString().slice(0, 10),
                  pingedAt: now.toISOString(),
                },
              ],
            },
          }).catch((e: any) => console.warn('[tracker] ping failed:', e?.message));
        },
        (err: any) => console.warn('[tracker] geolocation error:', err?.message),
        { enableHighAccuracy: true, timeout: 20000, maximumAge: 10000 },
      );
    };

    const start = async () => {
      if (timer.current || cancelled) return;
      const ok = await ensurePermission();
      if (!ok || cancelled) return;
      sendPing(); // immediate first fix
      timer.current = setInterval(sendPing, PING_INTERVAL_MS);
    };

    const stop = () => {
      if (timer.current) {
        clearInterval(timer.current);
        timer.current = null;
      }
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
