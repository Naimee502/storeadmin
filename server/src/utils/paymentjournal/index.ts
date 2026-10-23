const r2 = (n: any) => parseFloat((Number(n) || 0).toFixed(2));

/**
 * Discount and commission on a payment. They can sit on the bill lines OR on
 * the payment itself (an opening-balance-only receipt has no line), so the
 * larger of the two is the total — same rule as computeUnallocated and the
 * statements.
 */
export function paymentConcessions(p: any): { discount: number; commission: number } {
  const lines = Array.isArray(p?.invoices) ? p.invoices : [];
  const discount = Math.max(
    r2(lines.reduce((s: number, i: any) => s + (Number(i.discount) || 0), 0)),
    r2(p?.discount)
  );
  const commission = Math.max(
    r2(lines.reduce((s: number, i: any) => s + (Number(i.commission) || 0), 0)),
    r2(p?.commission)
  );
  return { discount, commission };
}

/**
 * How much the PARTY's balance moves: the cash, plus the discount we allowed
 * (it clears the bill too), minus the commission charged on top (it rode in
 * on the cash but is not a bill payment).
 *
 *   party leg = cash + discount − commission   (= what was settled)
 */
export function partyLegAmount(p: any): number {
  const { discount, commission } = paymentConcessions(p);
  return r2((Number(p?.amount) || 0) + discount - commission);
}
