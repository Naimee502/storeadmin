import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { useAuth } from '../navigation';
import { setTenant } from '../store/slices';
import { apolloClient } from '../apollo/client';
import { GET_ADMIN_BY_CODE } from '../apollo/queries/admin';
import { GET_BRANCHES } from '../apollo/queries/branches';
import { GET_ADMIN_SETTINGS } from '../apollo/queries/accounts';
import { getAdminCode } from '../config/buildconfig';
import { useToast } from 'react-native-toast-notifications';

/**
 * Auto-activates business using hardcoded admin code from build config
 * Removes need for AdminSetup screen - business code is embedded per flavor
 * 
 * Usage: Call once in RootNavigator when app loads
 */
export const useAutoActivateBusiness = () => {
  const { isActivated, activateBusiness } = useAuth();
  const dispatch = useDispatch();
  const toast = useToast();

  useEffect(() => {
    if (isActivated) return; // Already activated, skip

    const activateBusinessAuto = async () => {
      try {
        const adminCode = getAdminCode();

        const { data } = await apolloClient.query({
          query: GET_ADMIN_BY_CODE,
          variables: { admincode: adminCode },
          fetchPolicy: 'network-only',
        });

        const admin = (data as any)?.getAdminByCode;
        
        if (!admin) {
          console.error('❌ Business code not found:', adminCode);
          toast.show(`Business code ${adminCode} not found. Check server connection.`, {
            type: 'danger',
            duration: 4000,
          });
          return;
        }


        const companyName = admin.companyName || 'My Business';

        // Fetch branch
        let branchId: string | null = null;
        try {
          const { data: branchData } = await apolloClient.query({
            query: GET_BRANCHES,
            variables: { adminId: admin.id },
            fetchPolicy: 'network-only',
          });
          const branches: any[] = (branchData as any)?.getBranches ?? [];
          branchId = (branches.find((b: any) => b.status !== false) ?? branches[0])?.id ?? null;
        } catch (e) {
          console.warn('⚠️ Could not fetch branches:', e);
        }

        // Fetch branding settings
        let logoUrl: string | null = null;
        let primaryColor: string | null = null;
        try {
          const { data: settingsData } = await apolloClient.query({
            query: GET_ADMIN_SETTINGS,
            variables: { adminid: admin.id },
            fetchPolicy: 'network-only',
          });
          logoUrl = (settingsData as any)?.getAdminSettings?.brandLogo || null;
          primaryColor = (settingsData as any)?.getAdminSettings?.themeBrandColor || null;
        } catch (e) {
          console.warn('⚠️ Could not fetch branding settings:', e);
        }

        // Store tenant info in Redux
        dispatch(setTenant({
          adminId: admin.id,
          companyName,
          logoUrl,
          primaryColor,
          tagline: null,
          branchId,
          businessCode: adminCode,
        }));

        activateBusiness();

      } catch (error: any) {
        const isNetwork = error?.networkError || 
                         error?.message?.toLowerCase().includes('network') || 
                         error?.message?.toLowerCase().includes('fetch');
        
        console.error('❌ Auto-activation failed:', error);
        toast.show(
          isNetwork
            ? 'Cannot connect to server. Check your internet connection.'
            : 'Failed to activate business. Please check the admin code.',
          { type: 'danger', duration: 4000 },
        );
      }
    };

    activateBusinessAuto();
  }, [isActivated, dispatch, activateBusiness, toast]);
};
