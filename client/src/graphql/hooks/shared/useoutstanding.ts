import { useMemo } from "react";
import { usePaymentsQuery } from "../payments";
import { useTransactionsQuery } from "../transactions";
import { useSalesReturnsQuery } from "../salesreturn";
import { usePurchaseReturnsQuery } from "../purchasereturn";

/** Outstanding = total − payment allocations − journal allocations − un-refunded returns (never stored). */

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

  // ── Settled per invoice: Payments + "Agst Ref" journal transactions
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

  // Credit-note value still against each source invoice
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

  /** Over-payment credit per bill; party balances must subtract it like an advance. */
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
