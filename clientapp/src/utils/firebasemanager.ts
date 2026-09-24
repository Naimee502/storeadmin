import messaging, { FirebaseMessagingTypes } from '@react-native-firebase/messaging';
import notifee, { EventType } from '@notifee/react-native';
import { navigate } from './navigationservice';
import {
  displayRemoteMessage,
  ensureNotificationChannel,
  requestAndroidNotificationPermission,
} from './notificationchannel';

class FirebaseManager {
  async register() {
    try {
      await this.requestPermission();
      this.createNotificationListeners();
      this.setupNotifeeListeners();
    } catch (error) {
      console.warn(
        '[FirebaseManager] Firebase initialization failed. Push notifications will be disabled until Firebase is configured in the project: ',
        error
      );
    }
  }

  async requestPermission() {
    try {
      await ensureNotificationChannel();
      const androidGranted = await requestAndroidNotificationPermission();
      if (!androidGranted) {
        console.warn('[FirebaseManager] Notification permission denied — pushes will not show.');
      }
      const authStatus = await messaging().requestPermission();
      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;

      if (enabled) {
        await this.getToken();
      }
    } catch (error) {
      console.error('[FirebaseManager] Error requesting permission:', error);
      throw error;
    }
  }

  async getToken() {
    try {
      const token = await messaging().getToken();
      return token;
    } catch (error) {
      console.error('[FirebaseManager] Failed to get FCM token:', error);
    }
  }

  private createNotificationListeners() {
    try {
      messaging().onMessage(async (remoteMessage) => {
        this.displayLocalNotification(remoteMessage);
      });

      messaging().onNotificationOpenedApp((remoteMessage) => {
        this.handleNotificationNavigation(remoteMessage);
      });

      messaging()
        .getInitialNotification()
        .then((remoteMessage) => {
          if (remoteMessage) {
            setTimeout(() => {
              this.handleNotificationNavigation(remoteMessage);
            }, 1000);
          }
        })
        .catch((err) => {
          console.error('[FirebaseManager] Error getting initial notification:', err);
        });
    } catch (error) {
      console.error('[FirebaseManager] Error creating notification listeners:', error);
    }
  }

  private setupNotifeeListeners() {
    notifee.onForegroundEvent(({ type, detail }) => {
      if (type === EventType.PRESS && detail.notification) {
        const remoteMessage = detail.notification.data;
        if (remoteMessage) {
          this.handleNotificationNavigation({ data: remoteMessage } as any);
        }
      }
    });

    // App opened by tapping a notification that notifee showed while the app
    // was in the background or closed (all server pushes are data-only now,
    // so they are shown by notifee, not by Android).
    notifee
      .getInitialNotification()
      .then((initial) => {
        const data = initial?.notification?.data;
        if (data) {
          setTimeout(() => this.handleNotificationNavigation({ data } as any), 1000);
        }
      })
      .catch(() => {});

  }

  private async displayLocalNotification(remoteMessage: FirebaseMessagingTypes.RemoteMessage) {
    await displayRemoteMessage(remoteMessage);
  }

  private handleNotificationNavigation(remoteMessage: FirebaseMessagingTypes.RemoteMessage) {
    const { data } = remoteMessage || ({} as any);
    if (!data) return;

    // Explicit route name, if a sender ever provides one.
    if (data.screen) {
      const { screen, ...params } = data;
      navigate(screen as string, params);
      return;
    }
    // Server pushes (utils/fcm) — open the notifications list, which is
    // registered for every role.
    navigate('Notifications');
  }
}

export default new FirebaseManager();
