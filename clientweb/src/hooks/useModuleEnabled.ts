import { useQuery } from "@apollo/client";
import { useTenant } from "../contexts/tenant";
import { GET_ADMIN_BY_ID } from "../graphql/queries/accounts";

// Is a business module enabled (admin-level allowedmodules)? Ported from
// clientapp's useModuleEnabled — null/empty allowedmodules means "all
// modules allowed" (legacy tenants). Used to decide whether a channel
// party sees "Convert to Invoice" (salesinvoice module on) or just
// "Mark Confirmed" on a downline order.
export function useModuleEnabled(moduleId: string): boolean {
  const { adminid } = useTenant();
  const { data } = useQuery(GET_ADMIN_BY_ID, {
    variables: { id: adminid },
    skip: !adminid,
    fetchPolicy: "cache-and-network",
  });
  const allowed: string[] | null = data?.getAdminById?.allowedmodules ?? null;
  if (allowed === null || allowed.length === 0) return true;
  return allowed.some((m) => (m || "").toLowerCase() === moduleId.toLowerCase());
}

/**
 * Business Settings → Business Modules → Accounting → "Payments". Off means
 * the site shows no payment surface at all: no Payments tab or header link,
 * and the sub-party payments / collect pages redirect back to My Account.
 */
export const usePaymentsEnabled = (): boolean => useModuleEnabled("payments");
