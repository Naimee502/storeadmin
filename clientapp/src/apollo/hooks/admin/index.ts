import { useQuery } from '@apollo/client/react';
import { useSelector } from 'react-redux';
import { GET_ADMIN_BY_ID } from '../../queries/admin';
import type { RootState } from '../../../store/rootreducer';

export const useAdminQuery = () => {
  const adminId = useSelector((s: RootState) => s.tenant.adminId);
  return useQuery(GET_ADMIN_BY_ID, {
    variables: { adminid: adminId },
    skip: !adminId,
    fetchPolicy: 'cache-and-network',
  });
};

// Is a business module enabled (admin-level allowedmodules)?
// null/empty allowedmodules = "all modules allowed" (legacy tenants).
export const useModuleEnabled = (moduleId: string): boolean => {
  const { data } = useAdminQuery();
  const allowed: string[] | null = (data as any)?.getAdminById?.allowedmodules ?? null;
  if (allowed === null || allowed.length === 0) return true;
  return allowed.some((m) => (m || '').toLowerCase() === moduleId.toLowerCase());
};

/**
 * Business Settings → Business Modules → Accounting → "Payments".
 *
 * Off means the business does not take payments through the app at all, so
 * every payment surface disappears for every role — the party's Payments tab,
 * the salesman's and delivery boy's Collect Payment, the Collections tab, the
 * "Collected" figures on their dashboards. PAYMENT_SCREENS below is also
 * dropped from the navigators, so nothing can reach them by a stale link.
 */
export const PAYMENTS_MODULE = 'payments';
export const usePaymentsEnabled = (): boolean => useModuleEnabled(PAYMENTS_MODULE);

/** Every route that exists only to show or take a payment. */
export const PAYMENT_SCREENS = new Set<string>([
  'Payments',               // party tab
  'PartyPaymentsView',      // channel party → a sub-party's payments
  'PaymentDetail',
  'CollectPayment',         // party (downline) + salesman
  'DeliveryCollections',    // delivery boy tab
  'DeliveryCollectPayment',
]);
