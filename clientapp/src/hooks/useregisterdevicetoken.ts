import { useEffect } from 'react';
import messaging from '@react-native-firebase/messaging';
import { useMutation } from '@apollo/client/react';
import { useSelector } from 'react-redux';
import { SAVE_DEVICE_TOKEN } from '../apollo/mutations/tracking';
import type { RootState } from '../store/rootreducer';

/**
 * Registers this device's FCM token against the logged-in staff so the backend
 * can push notifications to them. Also listens for token refreshes.
 */
export function useRegisterDeviceToken() {
  const user = useSelector((s: RootState) => s.auth.user);
  const [saveToken] = useMutation(SAVE_DEVICE_TOKEN);

  useEffect(() => {
    if (!user?.id) return;
    let unsub: (() => void) | undefined;

    (async () => {
      try {
        const token = await messaging().getToken();
        if (token) {
          await saveToken({ variables: { id: user.id, token } }).catch(() => {});
        }
        unsub = messaging().onTokenRefresh((t) => {
          saveToken({ variables: { id: user.id, token: t } }).catch(() => {});
        });
      } catch (e: any) {
        console.warn('[fcm] device token registration failed:', e?.message);
      }
    })();

    return () => {
      if (unsub) unsub();
    };
  }, [user?.id, saveToken]);
}
