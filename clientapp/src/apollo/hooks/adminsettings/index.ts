import { useQuery } from '@apollo/client/react';
import { useSelector } from 'react-redux';
import { GET_ADMIN_SETTINGS } from '../../queries/accounts';
import type { RootState } from '../../../store/rootreducer';

// Whether product prices (price, MRP, discount, cart/order totals) should be
// shown. Admin-controlled via Business Settings → "Display Product Prices on
// App/Website" (displayProductPriceOnWebsite). Defaults to true (server
// default) so tenants who haven't touched the setting see no change.
export function useShowProductPrice(): boolean {
  const adminid = useSelector((s: RootState) => s.tenant.adminId) ?? '';
  const { data } = useQuery(GET_ADMIN_SETTINGS, {
    variables: { adminid },
    skip: !adminid,
    fetchPolicy: 'cache-and-network',
  });
  return (data as any)?.getAdminSettings?.displayProductPriceOnWebsite !== false;
}
