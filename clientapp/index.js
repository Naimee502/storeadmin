import { AppRegistry } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import notifee from '@notifee/react-native';
import App from './App';
import { name as appName } from './app.json';
import { displayRemoteMessage } from './src/utils/notificationchannel';

// App in background / closed. Messages that carry a "notification" payload
// (everything the server sends) are shown in the status bar by Android itself.
// Data-only messages are not, so show those here via notifee.
messaging().setBackgroundMessageHandler(async (remoteMessage) => {
  if (!remoteMessage?.notification) {
    await displayRemoteMessage(remoteMessage);
  }
});

// Required by notifee for taps on notifications it displayed while the app
// was in background. Navigation happens once the app opens (FirebaseManager).
notifee.onBackgroundEvent(async () => {});

AppRegistry.registerComponent(appName, () => App);
