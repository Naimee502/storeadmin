import { useEffect, useCallback } from 'react';
import { Alert, Platform } from 'react-native';
import SpInAppUpdates, {
  NeedsUpdateResponse,
  IAUUpdateKind,
  StartUpdateOptions,
  StatusUpdateEvent,
  InstallationResult,
} from 'sp-react-native-in-app-updates';

const UPDATE_TYPE: IAUUpdateKind = IAUUpdateKind.FLEXIBLE;

const IMMEDIATE_BELOW_VERSION = '';

const inAppUpdates = new SpInAppUpdates(
  __DEV__, 
);

export function useInAppUpdate() {
  const handleFlexibleUpdateDownloaded = useCallback(() => {
    Alert.alert(
      'Update Ready',
      'A new version has been downloaded. Restart the app to apply the update.',
      [
        { text: 'Later', style: 'cancel' },
        {
          text: 'Restart Now',
          onPress: () => {
            inAppUpdates.installUpdate();
          },
        },
      ],
      { cancelable: false },
    );
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'android') {
      return;
    }

    let statusListener: ((event: StatusUpdateEvent) => void) | null = null;

    const checkAndStartUpdate = async () => {
      try {
        const result: NeedsUpdateResponse = await inAppUpdates.checkNeedsUpdate();

        if (!result.shouldUpdate) {
          return;
        }

        let updateKind = UPDATE_TYPE;
        if (
          IMMEDIATE_BELOW_VERSION &&
          result.storeVersion &&
          compareVersions(result.storeVersion, IMMEDIATE_BELOW_VERSION) >= 0
        ) {
          updateKind = IAUUpdateKind.IMMEDIATE;
        }

        const updateOptions: StartUpdateOptions = {
          updateType: updateKind,
        };

        if (updateKind === IAUUpdateKind.FLEXIBLE) {
          statusListener = (event: StatusUpdateEvent) => {
            if (event.status === 5) {
              handleFlexibleUpdateDownloaded();
            }
          };
          inAppUpdates.addStatusUpdateListener(statusListener);
        }

        await inAppUpdates.startUpdate(updateOptions);
      } catch (error) {
        if (__DEV__) {
          console.warn('[InAppUpdate] Error checking for update:', error);
        }
      }
    };

    checkAndStartUpdate();

    return () => {
      if (statusListener) {
        inAppUpdates.removeStatusUpdateListener(statusListener);
      }
    };

  }, []);
}

function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) {
      return diff;
    }
  }
  return 0;
}
