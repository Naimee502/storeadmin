import { AppRegistry } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import App from './App';
import { name as appName } from './app.json';

// Handle data / notification messages received while the app is in the
// background or quit. Notification-type messages are shown by the OS
// automatically; this handler lets us react to data-only messages too.
messaging().setBackgroundMessageHandler(async (remoteMessage) => {
  console.log('[FCM] Background message:', remoteMessage?.messageId);
});

AppRegistry.registerComponent(appName, () => App);
