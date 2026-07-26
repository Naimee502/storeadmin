import { useQuery } from "@apollo/client";
import { useTenant } from "../contexts/tenant";
import { GET_CHARGE_RULES, GET_DELIVERY_MODE } from "../graphql/queries/accounts";
import { computeAutoCharges, type ChargePreview } from "../utils/chargerules";

// Cart/Checkout-side preview of the admin's auto-charge rules
// (delivery/handling/COD, etc.), ported verbatim from clientapp's
// apollo/hooks/chargerules — so what the website shows before an order is
// placed matches what the server actually adds via computeAutoCharges at
// order-creation time. Display-only: the order is still submitted with its
// own (charge-free) totals, the server applies these same rules on its own.
export function useChargePreview(subtotal: number, creatorType: string = "party", paymentType: string = "cash"): ChargePreview {
  const { adminid } = useTenant();

  const { data: rulesData } = useQuery(GET_CHARGE_RULES, {
    variables: { adminid },
    skip: !adminid,
    fetchPolicy: "cache-and-network",
  });
  const { data: settingsData } = useQuery(GET_DELIVERY_MODE, {
    variables: { adminid },
    skip: !adminid,
    fetchPolicy: "cache-and-network",
  });

  const rules = (rulesData as any)?.getChargeRules ?? [];
  const deliveryMode = (settingsData as any)?.getAdminSettings?.deliveryMode || "salesman";

  return computeAutoCharges(rules, { subtotal, paymentType, creatorType, deliveryMode });
}
