import { useQuery } from '@apollo/client/react';
import { useSelector } from 'react-redux';
import { GET_ADMIN_SETTINGS } from '../apollo/queries/accounts';
import type { RootState } from '../store/rootreducer';
import { useIsEndUserParty } from './enduser';

/**
 * Should this party see the catalogue browser instead of the storefront Home?
 *
 * Two Homes exist for a party. The storefront one — hero banner, category
 * circles, product cards with pictures and Add buttons — suits a shop selling
 * things people recognise by sight. It is useless to a business selling three
 * hundred sizes of the same brass fitting, where the customer knows exactly
 * what they want and just needs to type a quantity against each line. Those
 * get the catalogue: Category → Sub-category → an order sheet.
 *
 * The switch is per business, in Business Settings, so a new customer can be
 * turned on without a code change or a store release — which is what the
 * per-business-code tables this codebase used to carry always ended up needing.
 * There is deliberately no code-side override list here: one switch, one place.
 */
export const useCatalogBrowseMode = (): boolean => {
  const adminid = useSelector((s: RootState) => s.tenant.adminId) ?? '';
  const isParty = useSelector((s: RootState) => s.auth.user?.role) === 'party';

  const { data } = useQuery(GET_ADMIN_SETTINGS, {
    variables: { adminid },
    skip: !adminid,
    fetchPolicy: 'cache-and-network',
  });

  // Salesman, staff and delivery screens are order-entry tools already; this
  // only ever changes what a customer sees.
  if (!isParty) return false;

  return (data as any)?.getAdminSettings?.appCatalogBrowseMode === true;
};

/**
 * Re-exported so a screen deciding which Home to draw imports one thing.
 * The catalogue answer wins: a business that asked for the order sheet wants it
 * for every customer, shopper or trade.
 */
export { useIsEndUserParty };
