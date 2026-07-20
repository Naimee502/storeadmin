import { useQuery } from '@apollo/client/react';
import { useSelector } from 'react-redux';
import { GET_CHARGE_RULES, GET_ADMIN_SETTINGS } from '../../queries/accounts';
import { computeAutoCharges, type ChargePreview } from '../../../utils';
import type { RootState } from '../../../store/rootreducer';

// Cart-side preview of the admin's auto-charge rules (delivery/handling/COD),
// so what the user sees before placing an order matches what the server
// actually adds at order-creation time (computeAutoCharges in
// server/src/graphql/resolvers/salesorder/index.ts). Display-only — the
// order is still submitted with its original (charge-free) totalamount and
// the server applies these same charges on its own.
export function useChargePreview(subtotal: number, creatorType: string, paymentType: string = 'cash'): ChargePreview {
  const adminid = useSelector((s: RootState) => s.tenant.adminId) ?? '';

  const { data: rulesData } = useQuery(GET_CHARGE_RULES, {
    variables: { adminid },
    skip: !adminid,
    fetchPolicy: 'cache-and-network',
  });
  const { data: settingsData } = useQuery(GET_ADMIN_SETTINGS, {
    variables: { adminid },
    skip: !adminid,
    fetchPolicy: 'cache-and-network',
  });

  const rules = (rulesData as any)?.getChargeRules ?? [];
  const deliveryMode = (settingsData as any)?.getAdminSettings?.deliveryMode || 'salesman';

  return computeAutoCharges(rules, { subtotal, paymentType, creatorType, deliveryMode });
}
