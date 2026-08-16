import { useMemo } from "react";
import { usePaymentsQuery } from "../payments";
import { useTransactionsQuery } from "../transactions";
import { useSalesReturnsQuery } from "../salesreturn";
import { usePurchaseReturnsQuery } from "../purchasereturn";

/**
 * Single source of truth for "how much is still owed on this bill".
 *
 * An invoice's outstanding is NEVER stored — it is always derived, so deleting
 * a payment or a return automatically restores the balance. Three things
 * reduce it:
 *
 *   outstanding = totalamount
 *               − Σ Payment allocations        (Payment.invoices[].settledamount)
 *               − Σ Transaction allocations    (Tally "Agst Ref" journal settlements)
 *               − Σ un-refunded Returns        (SalesReturn / PurchaseReturn)
 *
 * ── Why returns need the "un-refunded" qualifier ────────────────────────────
 * A return always posts "Dr Sales Return / Cr Customer", which reduces what the
 * party owes. But when `refundMode` is "auto" AND the source bill was cash/bank,
 * the model ALSO creates a refund Payment ("Dr Customer / Cr Cash") that hands
 * the money back — the two legs cancel and the invoice debt stands.
 *
 * Rather than re-deriving that rule from refundMode + paymenttype (which drift
 * apart — e.g. refundMode "auto" on a CREDIT bill creates no refund at all), we
 * just check the data: if a refund Payment exists that references this return,
 * the money went back, so don't net it. Otherwise net it.
 *
 * Before this existed, returns were ignored entirely: a ₹2,000 return on a
 * ₹15,645 invoice left the Party Ledger saying ₹13,645 while the payment screen
 * still asked for ₹15,645.
 */

type Options = {
  /** Exclude the payment currently being edited so its own allocation isn't double-counted. */
  excludePaymentId?: string;
  /** Same, for the manual Transaction (journal) page. */
  excludeTransactionId?: string;
};

export const useOutstanding = ({ excludePaymentId, excludeTransactionId }: Options = {}) => {
  const { data: paymentsData } = usePaymentsQuery();
  const { data: transactionsData } = useTransactionsQuery();
  const { data: salesReturnsData } = useSalesReturnsQuery();
  const { data: purchaseReturnsData } = usePurchaseReturnsQuery();

  // ── Settled per invoice: Payments + "Agst Ref" journal transactions ──────
  const paidByInvoice = useMemo(() => {
    const map: Record<string, number> = {};

    (paymentsData?.getPayments || []).forEach((pay: any) => {
      if (excludePaymentId && pay.id === excludePaymentId) return;
      (pay.invoices || []).forEach((inv: any) => {
        if (inv.invoiceid) map[inv.invoiceid] = (map[inv.invoiceid] || 0) + (inv.settledamount || 0);
      });
    });

    (transactionsData?.getTransactions || []).forEach((txn: any) => {
      if (excludeTransactionId && txn.id === excludeTransactionId) return;
      (txn.invoices || []).forEach((inv: any) => {
        if (inv.invoiceid) map[inv.invoiceid] = (map[inv.invoiceid] || 0) + (inv.settledamount || 0);
      });
    });

    return map;
  }, [paymentsData, transactionsData, excludePaymentId, excludeTransactionId]);

  // ── Returns whose money was actually handed back (refund Payment exists) ──
  const refundedReturnIds = useMemo(() => {
    const s = new Set<string>();
    (paymentsData?.getPayments || []).forEach((pay: any) => {
      (pay.invoices || []).forEach((inv: any) => {
        if (
          inv.invoiceid &&
          (inv.invoicemodel === "SalesReturn" || inv.invoicemodel === "PurchaseReturn")
        ) {
          s.add(inv.invoiceid);
        }
      });
    });
    return s;
  }, [paymentsData]);

  // ── Credit-note value still sitting against each source invoice ──────────
  const returnsByInvoice = useMemo(() => {
    const map: Record<string, number> = {};

    const collect = (list: any[]) => {
      list.forEach((ret: any) => {
        if (!ret || ret.status === false) return;
        // Money already refunded in cash/bank → the invoice debt is untouched.
        if (refundedReturnIds.has(ret.id)) return;
        // sourceInvoiceId is a plain ID in the schema, but tolerate an object.
        const src =
          typeof ret.sourceInvoiceId === "string" ? ret.sourceInvoiceId : ret.sourceInvoiceId?.id;
        if (!src) return;
        map[src] = (map[src] || 0) + (Number(ret.totalamount) || 0);
      });
    };

    collect(salesReturnsData?.getSalesReturns || []);
    collect(purchaseReturnsData?.getPurchaseReturns || []);
    return map;
  }, [salesReturnsData, purchaseReturnsData, refundedReturnIds]);

  /** Outstanding for one invoice. Never negative — an over-return is capped at 0. */
  const outstandingOf = useMemo(
    () => (inv: any) => {
      if (!inv?.id) return 0;
      const total = Number(inv.totalamount) || 0;
      const paid = paidByInvoice[inv.id] || 0;
      const returned = returnsByInvoice[inv.id] || 0;
      return parseFloat(Math.max(0, total - paid - returned).toFixed(2));
    },
    [paidByInvoice, returnsByInvoice]
  );

  /**
   * Credit created when payments + returns exceed a bill's face value — the
   * "paid in full, returned afterwards" case. `outstandingOf` floors at zero,
   * so this is where that over-payment shows up. A party-level balance must
   * subtract it, exactly like an unallocated advance; ignoring it made the
   * party report disagree with the ledger by the returned amount.
   */
  const excessCreditOf = useMemo(
    () => (inv: any) => {
      if (!inv?.id) return 0;
      const total = Number(inv.totalamount) || 0;
      const paid = paidByInvoice[inv.id] || 0;
      const returned = returnsByInvoice[inv.id] || 0;
      return parseFloat(Math.max(0, paid + returned - total).toFixed(2));
    },
    [paidByInvoice, returnsByInvoice]
  );

  return { paidByInvoice, returnsByInvoice, refundedReturnIds, outstandingOf, excessCreditOf };
};
