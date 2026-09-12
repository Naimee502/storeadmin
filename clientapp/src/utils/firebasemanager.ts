import messaging, { FirebaseMessagingTypes } from '@react-native-firebase/messaging';
import notifee, { AndroidImportance, EventType } from '@notifee/react-native';
import { navigate } from './navigationservice';

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

    notifee.onBackgroundEvent(async ({ type, detail }) => {
      if (type === EventType.PRESS && detail.notification) {
      }
    });
  }

  private async displayLocalNotification(remoteMessage: FirebaseMessagingTypes.RemoteMessage) {
    const channelId = await notifee.createChannel({
      id: 'default',
      name: 'Default Channel',
      importance: AndroidImportance.HIGH,
    });

    await notifee.displayNotification({
      title: remoteMessage.notification?.title || 'Notification',
      body: remoteMessage.notification?.body || '',
      data: remoteMessage.data,
      android: {
        channelId,
        importance: AndroidImportance.HIGH,
        pressAction: {
          id: 'default',
        },
      },
    });
  }

  private handleNotificationNavigation(remoteMessage: FirebaseMessagingTypes.RemoteMessage) {
    const { data } = remoteMessage;

    if (!data) return;

    if (data.screen) {
      const { screen, ...params } = data;
      navigate(screen as string, params);
    } else {
      navigate('Home');
    }
  }
}

export default new FirebaseManager();
