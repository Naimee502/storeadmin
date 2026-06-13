import React, { useMemo } from "react";
import { useSalesInvoicesQuery } from "../../graphql/hooks/salesinvoice";
import { usePurchaseInvoicesQuery } from "../../graphql/hooks/purchaseinvoice";
import { usePaymentsQuery } from "../../graphql/hooks/payments";
import { useTransactionsQuery } from "../../graphql/hooks/transactions";

/**
 * Shared Tally-style bill allocation ("Agst Ref").
 *
 * Lists a party's outstanding invoices and lets the user allocate a settle
 * amount against each one. Outstanding is computed consistently across BOTH
 * Payments AND manual Transactions (journals), so a journal settlement reduces
 * the same outstanding a payment would — and vice-versa.
 *
 * Controlled component: parent owns the allocation array (invoiceid /
 * invoicemodel / settledamount) and passes value + onChange. Reused by the
 * Payment page, the manual Transaction page, the Expense Note page, and later
 * the mobile app (party / salesman / delivery-boy collection).
 */

export type Allocation = {
  invoiceid: string;
  invoicemodel: "SalesInvoice" | "PurchaseInvoice";
  settledamount: number;
};

type Props = {
  partyid: string;
  /** Which side of the books we are settling. */
  invoicemodel: "SalesInvoice" | "PurchaseInvoice";
  value: Allocation[];
  onChange: (next: Allocation[]) => void;
  /** Exclude the current doc (edit mode) so its own allocation isn't double-counted. */
  excludePaymentId?: string;
  excludeTransactionId?: string;
};

const fmt = (n: number) => (Number(n) || 0).toFixed(2);

const BillAllocation: React.FC<Props> = ({
  partyid,
  invoicemodel,
  value,
  onChange,
  excludePaymentId,
  excludeTransactionId,
}) => {
  const { data: salesInvData } = useSalesInvoicesQuery();
  const { data: purchaseInvData } = usePurchaseInvoicesQuery();
  const { data: paymentsData } = usePaymentsQuery();
  const { data: transactionsData } = useTransactionsQuery();

  // ── Already-settled per invoice (Payments + Transactions) ──────────────
  const paidByInvoice = useMemo(() => {
    const map: Record<string, number> = {};

    (paymentsData?.getPayments || []).forEach((pay: any) => {
      if (excludePaymentId && pay.id === excludePaymentId) return;
      (pay.invoices || []).forEach((inv: any) => {
        if (inv.invoiceid)
          map[inv.invoiceid] = (map[inv.invoiceid] || 0) + (inv.settledamount || 0);
      });
    });

    (transactionsData?.getTransactions || []).forEach((txn: any) => {
      if (excludeTransactionId && txn.id === excludeTransactionId) return;
      (txn.invoices || []).forEach((inv: any) => {
        if (inv.invoiceid)
          map[inv.invoiceid] = (map[inv.invoiceid] || 0) + (inv.settledamount || 0);
      });
    });

    return map;
  }, [paymentsData, transactionsData, excludePaymentId, excludeTransactionId]);

  // ── All invoices for the chosen side ───────────────────────────────────
  const allInvoices = useMemo(() => {
    const src =
      invoicemodel === "SalesInvoice"
        ? (salesInvData?.getSalesInvoices || [])
        : (purchaseInvData?.getPurchaseInvoices || []);
    return src.map((inv: any) => ({ ...inv, invoicemodel }));
  }, [invoicemodel, salesInvData, purchaseInvData]);

  // ── Outstanding invoices for this party ────────────────────────────────
  const outstandingInvoices = useMemo(() => {
    if (!partyid) return [];
    return allInvoices
      .filter((inv: any) => inv.partyacc?.id === partyid && inv.status)
      .map((inv: any) => {
        const paid = paidByInvoice[inv.id] || 0;
        const outstanding = parseFloat(((inv.totalamount || 0) - paid).toFixed(2));
        return { ...inv, outstanding };
      })
      .filter((inv: any) => inv.outstanding > 0);
  }, [partyid, allInvoices, paidByInvoice]);

  // Rows to render = outstanding invoices + any already-selected invoice that
  // is now fully settled (so edit mode still shows the allocation row).
  const rows = useMemo(() => {
    const list = [...outstandingInvoices];
    value.forEach((a) => {
      if (!list.some((r: any) => r.id === a.invoiceid)) {
        const full = allInvoices.find((inv: any) => inv.id === a.invoiceid);
        if (full) list.push({ ...full, outstanding: 0 });
      }
    });
    return list;
  }, [outstandingInvoices, value, allInvoices]);

  const selectedFor = (invId: string) => value.find((s) => s.invoiceid === invId);

  const toggleInvoice = (inv: any) => {
    if (selectedFor(inv.id)) {
      onChange(value.filter((s) => s.invoiceid !== inv.id));
    } else {
      onChange([
        ...value,
        {
          invoiceid: inv.id,
          invoicemodel: inv.invoicemodel,
          settledamount: inv.outstanding,
        },
      ]);
    }
  };

  const updateAmount = (invoiceid: string, amount: number) => {
    onChange(value.map((s) => (s.invoiceid === invoiceid ? { ...s, settledamount: amount } : s)));
  };

  const total = parseFloat(
    value.reduce((s, i) => s + (i.settledamount || 0), 0).toFixed(2)
  );

  if (!partyid) {
    return (
      <p className="text-sm text-gray-500">
        Select a party to load their outstanding invoices.
      </p>
    );
  }

  if (rows.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        No outstanding {invoicemodel === "SalesInvoice" ? "sales" : "purchase"} invoices found
        for this party.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead className="bg-gray-50">
            <tr className="text-left">
              <th className="px-3 py-2 w-10"></th>
              <th className="px-3 py-2">Invoice #</th>
              <th className="px-3 py-2 text-right">Subtotal</th>
              <th className="px-3 py-2 text-right">Other Charges</th>
              <th className="px-3 py-2 text-right">GST</th>
              <th className="px-3 py-2 text-right">Invoice Total</th>
              <th className="px-3 py-2 text-right text-orange-600">Outstanding</th>
              <th className="px-3 py-2 text-right">Settle Now</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((inv: any) => {
              const selected = selectedFor(inv.id);
              const otherChargesTotal = (inv.othercharges || []).reduce(
                (s: number, c: any) => s + (c.totalamount || 0),
                0
              );
              return (
                <tr
                  key={inv.id}
                  className={`border-t ${selected ? "bg-blue-50" : "hover:bg-gray-50"}`}
                >
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={!!selected}
                      onChange={() => toggleInvoice(inv)}
                      className="w-4 h-4"
                    />
                  </td>
                  <td className="px-3 py-2 font-medium">
                    {inv.invoicemodel === "PurchaseInvoice" ? "PUR-" : "INV-"}
                    {inv.billnumber}
                  </td>
                  <td className="px-3 py-2 text-right">₹{fmt(inv.subtotal || 0)}</td>
                  <td className="px-3 py-2 text-right">
                    <span>₹{fmt(otherChargesTotal)}</span>
                    {(inv.othercharges || []).length > 0 && (
                      <div className="text-xs text-gray-500 mt-0.5 space-y-0.5">
                        {inv.othercharges.map((c: any, ci: number) => (
                          <div key={ci} className="text-right">
                            {c.ledgerid?.ledgername || c.ledgername}: ₹{fmt(c.totalamount || 0)}
                          </div>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">₹{fmt(inv.totalgst || 0)}</td>
                  <td className="px-3 py-2 text-right font-semibold">
                    ₹{fmt(inv.totalamount || 0)}
                  </td>
                  <td className="px-3 py-2 text-right font-semibold text-orange-600">
                    ₹{fmt(inv.outstanding)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {selected ? (
                      <input
                        type="number"
                        className="w-28 border rounded px-2 py-1 border-gray-300 text-right"
                        value={selected.settledamount}
                        min={0.01}
                        step={0.01}
                        onChange={(e) =>
                          updateAmount(inv.id, parseFloat(e.target.value) || 0)
                        }
                      />
                    ) : (
                      <span className="text-gray-400 text-xs">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {value.length > 0 && (
        <div className="flex justify-end">
          <div className="bg-gray-50 border rounded-lg px-4 py-2 text-sm font-semibold">
            Allocated: ₹{fmt(total)} &nbsp;·&nbsp; {value.length} invoice(s)
          </div>
        </div>
      )}
    </div>
  );
};

export default BillAllocation;
