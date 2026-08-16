import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useQuery } from '@apollo/client/react';
import { useSelector } from 'react-redux';
import { GET_ADMIN_SETTINGS } from '../apollo/queries/accounts';
import { setScreenSecure } from '../utils/screenguard';
import type { RootState } from '../store/rootreducer';

/**
 * Keeps the app's capture protection in sync with
 * Business Settings → Screen Capture Protection → "Mobile app".
 *
 * Mounted once at the root (App.tsx) rather than per screen, so protection
 * covers every screen including native modals — a per-screen effect would
 * leave gaps exactly where sensitive data tends to live.
 *
 * Re-applies on foreground for two reasons:
 *  - Android clears window flags in some OEM process-restore paths, so a flag
 *    set before backgrounding isn't guaranteed to survive.
 *  - Someone can start a recording while the app is backgrounded; iOS doesn't
 *    reliably fire capturedDidChange for a suspended app, so we re-check.
 *
 * `cache-and-network` so flipping the setting in the admin panel takes effect
 * on the next foreground rather than waiting for the app to be reinstalled.
 */
export const useScreenGuard = () => {
  const adminid = useSelector((s: RootState) => s.tenant.adminId ?? '');

  const { data } = useQuery(GET_ADMIN_SETTINGS, {
    variables: { adminid },
    skip: !adminid,
    fetchPolicy: 'cache-and-network',
  });

  const enabled = !!(data as any)?.getAdminSettings?.secureScreenApp;

  useEffect(() => {
    // Runs for `false` too — turning the setting off must actually restore
    // capture so the owner can demo the app.
    setScreenSecure(enabled);

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') setScreenSecure(enabled);
    });
    return () => sub.remove();
  }, [enabled]);
};

export default useScreenGuard;
