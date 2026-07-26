// Mirrors computeAutoCharges() on the server
// (server/src/graphql/resolvers/salesorder/index.ts), ported verbatim from
// clientapp/src/utils/chargerules.ts. Lets the cart/checkout preview the
// delivery/handling/COD charges an order will pick up BEFORE it's placed,
// so what the customer sees matches what addSalesOrder actually charges.
// Display-only: the order is still submitted with the original (charge-free)
// totals — the server adds these same charges on its own at order-creation
// time.

export type ChargeRule = {
  id: string;
  name: string;
  chargeType?: string | null; // 'flat' | 'percent'
  value?: number | null;
  gstpercent?: number | null;
  minOrderValue?: number | null;
  freeAboveValue?: number | null;
  applyToCreatorTypes?: (string | null)[] | null;
  paymentTypes?: (string | null)[] | null;
  onlyWhenDeliveryBoy?: boolean | null;
  active?: boolean | null;
};

export type ChargeLine = {
  ruleId: string;
  name: string;
  amount: number;
  gstamount: number;
  totalamount: number;
};

export type ChargePreview = { lines: ChargeLine[]; total: number };

export function computeAutoCharges(
  rules: ChargeRule[] | null | undefined,
  opts: { subtotal: number; paymentType: string; creatorType: string; deliveryMode?: string }
): ChargePreview {
  const result: ChargePreview = { lines: [], total: 0 };
  if (!rules || !rules.length) return result;

  const base = Number(opts.subtotal || 0);
  const paymentType = String(opts.paymentType || "").toLowerCase();
  const creatorType = String(opts.creatorType || "").toLowerCase();
  const deliveryMode = opts.deliveryMode || "salesman";

  for (const rule of rules) {
    if (rule.active === false) continue;

    const creators = (rule.applyToCreatorTypes || []).filter(Boolean) as string[];
    if (creators.length && !creators.includes(creatorType)) continue;

    const pays = (rule.paymentTypes || []).filter(Boolean).map((p) => String(p).toLowerCase());
    if (pays.length && !pays.includes(paymentType)) continue;

    if (rule.onlyWhenDeliveryBoy && deliveryMode !== "deliveryboy") continue;

    if (Number(rule.minOrderValue || 0) > 0 && base < Number(rule.minOrderValue)) continue;
    if (Number(rule.freeAboveValue || 0) > 0 && base >= Number(rule.freeAboveValue)) continue;

    const amount =
      rule.chargeType === "percent"
        ? +((base * Number(rule.value || 0)) / 100).toFixed(2)
        : Number(rule.value || 0);
    if (amount <= 0) continue;

    const gstpercent = Number(rule.gstpercent || 0);
    const gstamount = +((amount * gstpercent) / 100).toFixed(2);
    const totalamount = +(amount + gstamount).toFixed(2);

    result.lines.push({ ruleId: rule.id, name: rule.name, amount, gstamount, totalamount });
    result.total += totalamount;
  }

  result.total = +result.total.toFixed(2);
  return result;
}
