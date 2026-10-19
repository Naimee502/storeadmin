import { useQuery } from '@apollo/client/react';
import { useSelector } from 'react-redux';
import { GET_ADMIN_BY_ID } from '../../queries/admin';
import { GET_STAFF_ACCOUNT } from '../../queries/staffaccounts';
import { IS_EXPENSE_CLAIMS_ENABLED } from '../../queries/expenseclaims';
import { IS_ANNOUNCEMENTS_ENABLED } from '../../queries/announcements';
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

/**
 * Module check for the signed-in user: business level (Admin.allowedmodules)
 * and, for staff / salesman / delivery-boy logins, their own staff-level list
 * too. Same rule everywhere — null / empty means "all on".
 */
export const useUserModuleEnabled = (moduleId: string): boolean => {
  const businessOn = useModuleEnabled(moduleId);
  const user = useSelector((s: RootState) => s.auth.user);
  const adminId = useSelector((s: RootState) => s.tenant.adminId);
  const role = (user?.role || '').toLowerCase();
  const isStaffRole = role === 'staff' || role === 'salesman' || role === 'deliveryboy';
  const { data } = useQuery(GET_STAFF_ACCOUNT, {
    variables: { id: user?.id, adminId },
    skip: !isStaffRole || !user?.id || !adminId,
    fetchPolicy: 'cache-and-network',
  });
  if (!businessOn) return false;
  if (!isStaffRole) return true;
  const allowed: string[] | null = (data as any)?.getStaffAccountById?.allowedmodules ?? null;
  if (allowed === null || allowed.length === 0) return true;
  return allowed.some((m) => (m || '').toLowerCase() === moduleId.toLowerCase());
};

/** Routes that exist only for one opt-in module — hidden while it is off. */
export const MODULE_SCREENS: Record<string, string> = {
  ExpenseClaims: 'expensenote',
  Announcements: 'announcements',
  // Business Modules → Sales → Sales Returns (business + staff level).
  SalesReturns: 'salesreturn',
  SalesReturnCreate: 'salesreturn',
};

/** Which module-gated routes the signed-in user may open right now. */
export const useModuleScreenGate = () => {
  // Expense Claims needs the Expense Notes module AND its "Expense Claims"
  // permission checkbox (Business Settings → Permissions) — the server
  // answers for the signed-in staff member, branch/staff overrides included.
  const user = useSelector((s: RootState) => s.auth.user);
  const role = (user?.role || '').toLowerCase();
  const isStaffRole = role === 'staff' || role === 'salesman' || role === 'deliveryboy';
  const expenseModuleOn = useUserModuleEnabled('expensenote');
  const { data: claimsData } = useQuery(IS_EXPENSE_CLAIMS_ENABLED, {
    skip: !isStaffRole || !expenseModuleOn,
    fetchPolicy: 'cache-and-network',
  });
  const expenseOn = expenseModuleOn && isStaffRole && (claimsData as any)?.isExpenseClaimsEnabled === true;
  // Announcements: module on AND at least one of its permission boxes ticked
  // (all unticked = business does not use it). The server decides, so party
  // and staff logins get the same answer the admin panel does.
  const announcementsModuleOn = useUserModuleEnabled('announcements');
  const { data: annData } = useQuery(IS_ANNOUNCEMENTS_ENABLED, {
    skip: !announcementsModuleOn || !user?.id,
    fetchPolicy: 'cache-and-network',
  });
  const announcementsOn = announcementsModuleOn && (annData as any)?.isAnnouncementsEnabled === true;
  const salesReturnOn = useUserModuleEnabled('salesreturn');
  const on: Record<string, boolean> = { expensenote: expenseOn, announcements: announcementsOn, salesreturn: salesReturnOn };
  return (screen?: string) => {
    if (!screen) return true;
    const mod = MODULE_SCREENS[screen];
    return !mod || on[mod] !== false;
  };
};
