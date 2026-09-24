import { PermissionsAndroid, Platform } from 'react-native';
import notifee, { AndroidImportance } from '@notifee/react-native';

// Must match android.notification.channel_id sent by the server (utils/fcm).
export const DEFAULT_CHANNEL_ID = 'default';

/** Creates the high-importance channel so pushes pop up in the status bar. Safe to call repeatedly. */
export const ensureNotificationChannel = () =>
  notifee.createChannel({
    id: DEFAULT_CHANNEL_ID,
    name: 'Default Channel',
    importance: AndroidImportance.HIGH,
    sound: 'default',
  });

/**
 * Android 13+ needs the runtime POST_NOTIFICATIONS permission, otherwise the
 * OS silently drops every notification. messaging().requestPermission() does
 * not show this dialog on Android, so ask for it explicitly.
 */
export const requestAndroidNotificationPermission = async (): Promise<boolean> => {
  if (Platform.OS !== 'android') return true;
  if (Number(Platform.Version) < 33) return true;
  const result = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
  );
  return result === PermissionsAndroid.RESULTS.GRANTED;
};

/** Shows a notification in the status bar from an FCM message (foreground or data-only). */
export const displayRemoteMessage = async (remoteMessage: any) => {
  const title = remoteMessage?.notification?.title || remoteMessage?.data?.title;
  if (!title) return;
  await ensureNotificationChannel();
  await notifee.displayNotification({
    title,
    body: remoteMessage?.notification?.body || remoteMessage?.data?.body || '',
    data: remoteMessage?.data,
    android: {
      channelId: DEFAULT_CHANNEL_ID,
      importance: AndroidImportance.HIGH,
      // White logo on transparent (android/app/src/*/res/drawable-*/ic_notification.png).
      smallIcon: 'ic_notification',
      color: '#1E7B3C',
      // The full-colour app logo (each flavor's own mipmap/ic_launcher) shown
      // inside the notification. The status-bar icon above can only ever be a
      // one-colour silhouette — that is an Android rule, not ours.
      largeIcon: 'ic_launcher',
      pressAction: { id: 'default' },
    },
  });
};
