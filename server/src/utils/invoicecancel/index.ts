// ---------------------------------------------------------------------------
// Guards for cancelling an invoice.
//
// Cancelling reverses a bill's stock, its journal and the receipt it raised at
// the counter. That is safe only while nothing else has been built on top of
// the bill. Once a return has been booked against it, or a payment collected
// for it in the Payments module, reversing the bill would leave those documents
// pointing at something that no longer exists — a refund against a bill that
// was never issued, a receipt allocated to nothing.
//
// So the rule is: cancel is for a bill entered by mistake and caught early.
// Anything later is a Return, which is a document in its own right and leaves
// the original bill standing, exactly as the GST rules expect.
//
// These checks refuse loudly and name what is in the way, because "cannot
// cancel" with no reason sends the user hunting through three screens.
// ---------------------------------------------------------------------------

import { Payment } from "../../models/payments";

export type InvoiceKind = "SalesInvoice" | "PurchaseInvoice";

/**
 * Throws unless this invoice can be cancelled right now.
 * Returns nothing — it is used for its refusal.
 */
export async function assertInvoiceCancellable(opts: {
  inv: any;
  docmodel: InvoiceKind;
  /** SalesReturn / PurchaseReturn model, to look for documents built on this bill. */
  ReturnModel: any;
  /** What to call that document in the message the user reads. */
  returnLabel: string;
}): Promise<void> {
  const { inv, docmodel, ReturnModel, returnLabel } = opts;
  const noun = docmodel === "SalesInvoice" ? "invoice" : "purchase invoice";

  if (inv.status === false) {
    throw new Error(`This ${noun} is deleted. Restore it first if you want to cancel it.`);
  }
  if (String(inv.cancelStatus || "") === "cancelled") {
    throw new Error(`This ${noun} is already cancelled.`);
  }

  // 1. A return already booked against it.
  const returns: any[] = await ReturnModel.find({
    sourceInvoiceId: inv._id,
    status: { $ne: false },
  })
    .select("billnumber")
    .lean();
  if (returns.length) {
    const nums = returns.map((r: any) => `#${r.billnumber}`).join(", ");
    throw new Error(
      `A ${returnLabel} (${nums}) has already been booked against this ${noun}, so it can no longer be cancelled. ` +
        `Delete that ${returnLabel} first, or leave the bill as it is.`
    );
  }

  // 2. Money collected against it outside the bill itself. The receipt the bill
  //    raised for its own "Received" amount does not count — cancelling removes
  //    that one, because it belongs to the bill.
  const pays: any[] = await Payment.find({
    status: true,
    "invoices.invoiceid": inv._id,
  })
    .select("paymentcode autosource")
    .lean();

  const external = pays.filter(
    (p: any) =>
      !(
        p?.autosource?.docmodel === docmodel &&
        String(p?.autosource?.docid) === String(inv._id)
      )
  );

  if (external.length) {
    const codes = external.map((p: any) => p.paymentcode || p._id).join(", ");
    const what = docmodel === "SalesInvoice" ? "Payment-In" : "Payment-Out";
    throw new Error(
      `${external.length} ${what} entry (${codes}) is already allocated to this ${noun}, so it can no longer be cancelled. ` +
        `Remove that allocation first, or record a ${returnLabel} instead.`
    );
  }
}

/** Throws unless this invoice is one that can be re-opened. */
export function assertInvoiceReopenable(inv: any, docmodel: InvoiceKind): void {
  const noun = docmodel === "SalesInvoice" ? "invoice" : "purchase invoice";
  if (inv.status === false) {
    throw new Error(`This ${noun} is deleted. Restore it before re-opening.`);
  }
  if (String(inv.cancelStatus || "") !== "cancelled") {
    throw new Error(`This ${noun} is not cancelled.`);
  }
}
