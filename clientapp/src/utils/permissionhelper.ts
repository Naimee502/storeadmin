import { Platform, Alert } from 'react-native';
import {
  check,
  request,
  PERMISSIONS,
  RESULTS,
  openSettings,
} from 'react-native-permissions';
import { STRINGS } from '../config';

export type AppPermissionType =
  | 'camera'
  | 'gallery'
  | 'location'
  | 'microphone'
  | 'audio'
  | 'notifications';

const androidVersion = typeof Platform.Version === 'string' ? parseInt(Platform.Version, 10) : Platform.Version;

const PLATFORM_PERMISSIONS: Record<AppPermissionType, any> = {
  camera: Platform.select({
    android: PERMISSIONS.ANDROID.CAMERA,
    ios: PERMISSIONS.IOS.CAMERA,
  }),
  gallery: Platform.select({
    android: androidVersion >= 33 ? PERMISSIONS.ANDROID.READ_MEDIA_IMAGES : PERMISSIONS.ANDROID.READ_EXTERNAL_STORAGE,
    ios: PERMISSIONS.IOS.PHOTO_LIBRARY,
  }),
  location: Platform.select({
    android: PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION,
    ios: PERMISSIONS.IOS.LOCATION_WHEN_IN_USE,
  }),
  microphone: Platform.select({
    android: PERMISSIONS.ANDROID.RECORD_AUDIO,
    ios: PERMISSIONS.IOS.MICROPHONE,
  }),
  audio: Platform.select({
    android: androidVersion >= 33 ? PERMISSIONS.ANDROID.READ_MEDIA_AUDIO : PERMISSIONS.ANDROID.READ_EXTERNAL_STORAGE,
    ios: PERMISSIONS.IOS.MEDIA_LIBRARY,
  }),
  notifications: Platform.select({
    android: (PERMISSIONS.ANDROID as any).POST_NOTIFICATIONS,
    ios: PERMISSIONS.IOS.APP_TRACKING_TRANSPARENCY,
  }),
};

class PermissionHelper {
  async checkPermission(type: AppPermissionType): Promise<boolean> {
    const permission = PLATFORM_PERMISSIONS[type];
    if (!permission) return true;

    try {
      const result = await check(permission);
      return result === RESULTS.GRANTED;
    } catch (error) {
      console.error(`Error checking ${type} permission:`, error);
      return false;
    }
  }

  async requestPermission(type: AppPermissionType, title?: string, message?: string): Promise<boolean> {
    const permission = PLATFORM_PERMISSIONS[type];
    if (!permission) return true;

    try {
      const result = await request(permission);

      if (result === RESULTS.GRANTED) {
        return true;
      }

      if (result === RESULTS.BLOCKED || result === RESULTS.DENIED) {
        this.showSettingsAlert(type, title, message);
      }

      return false;
    } catch (error) {
      console.error(`Error requesting ${type} permission:`, error);
      return false;
    }
  }

  private showSettingsAlert(type: AppPermissionType, title?: string, message?: string) {
    const s = (STRINGS.permissions as any)[type];
    
    Alert.alert(
      title || s?.title || 'Permission Required',
      message || s?.message || 'Please enable permission in settings.',
      [
        { text: STRINGS.common.notNow, style: 'cancel' },
        { text: STRINGS.common.openSettings, onPress: () => openSettings() },
      ],
      { cancelable: true }
    );
  }

  async checkMultiplePermissions(types: AppPermissionType[]): Promise<Record<AppPermissionType, boolean>> {
    const results: any = {};
    for (const type of types) {
      results[type] = await this.checkPermission(type);
    }
    return results;
  }
}

export default new PermissionHelper();
