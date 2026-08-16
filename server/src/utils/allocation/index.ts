// ---------------------------------------------------------------------------
// Bill allocation — the server-side twin of client `useOutstanding`.
//
// An invoice's outstanding is never stored. It is always:
//
//   outstanding = totalamount
//               − Σ Payment allocations        (Payment.invoices[].settledamount)
//               − Σ Transaction allocations    (Tally "Agst Ref" journal settlements)
//               − Σ un-refunded Returns        (SalesReturn / PurchaseReturn)
//
// A return only reduces the debt when the money was NOT handed back. When the
// model creates a refund Payment for a return, the two legs cancel out, so we
// detect that by looking for a Payment line referencing the return itself
// rather than re-deriving it from refundMode + paymenttype (which disagree —
// refundMode "auto" on a CREDIT bill creates no refund at all).
//
// Models are resolved through mongoose.model() rather than imported, because
// salesinvoice/purchaseinvoice import this file and direct imports would make
// the module graph circular.
// ---------------------------------------------------------------------------

import mongoose from "mongoose";

export type InvoiceModel = "SalesInvoice" | "PurchaseInvoice";

export type OutstandingBill = {
  id: string;
  billnumber: string;
  billdate: string;
  duedate: string;
  totalamount: number;
  outstanding: number;
  /**
   * Credit created when payments + returns exceed the bill's face value —
   * typically "paid in full, returned later". `outstanding` floors at zero, so
   * without this the over-payment silently vanished and the party report
   * disagreed with the ledger.
   */
  excess: number;
  invoicemodel: InvoiceModel;
};

const round2 = (n: number) => parseFloat((Number(n) || 0).toFixed(2));

const RETURN_MODEL: Record<InvoiceModel, string> = {
  SalesInvoice: "SalesReturn",
  PurchaseInvoice: "PurchaseReturn",
};

/**
 * Every bill for a party with its computed position, oldest first (or newest
 * first for LIFO) — including bills that are settled or over-credited.
 * `excludePaymentId` drops the payment currently being edited so its own
 * allocation isn't counted against itself.
 */
export async function getPartyBillPositions(opts: {
  partyid: any;
  invoicemodel: InvoiceModel;
  /** Omit to derive it from the party account — handy for party-level callers
   *  (reminders, the mobile collection view) that only hold an account id. */
  adminid?: any;
  branchid?: any;
  excludePaymentId?: any;
  /** Leave this bill out of the list entirely — used by the printed
   *  "Previous Balance", which means what the party owed BEFORE this bill. */
  excludeInvoiceId?: any;
  order?: "fifo" | "lifo";
}): Promise<OutstandingBill[]> {
  const { partyid, invoicemodel, branchid, excludePaymentId, excludeInvoiceId, order = "fifo" } = opts;
  if (!partyid) return [];

  let adminid = opts.adminid;
  if (!adminid) {
    const acc: any = await mongoose.model("Account").findById(partyid).select("admin").lean();
    adminid = acc?.admin;
    if (!adminid) return [];
  }

  const Invoice = mongoose.model(invoicemodel);
  const Payment = mongoose.model("Payment");
  const Transaction = mongoose.model("Transaction");
  const Return = mongoose.model(RETURN_MODEL[invoicemodel]);

  const invQuery: any = { partyacc: partyid, adminid, status: true };
  if (branchid) invQuery.branchid = branchid;
  if (excludeInvoiceId) invQuery._id = { $ne: excludeInvoiceId };

  const invoices: any[] = await Invoice.find(invQuery)
    .select("_id billnumber billdate duedate totalamount")
    .lean();
  if (!invoices.length) return [];

  const invoiceIds = invoices.map((i) => i._id);

  // ── Payment allocations ────────────────────────────────────────────────
  const payQuery: any = { adminid, status: true, "invoices.invoiceid": { $in: invoiceIds } };
  if (excludePaymentId) payQuery._id = { $ne: excludePaymentId };
  const payments: any[] = await Payment.find(payQuery).select("invoices").lean();

  // ── Journal ("Agst Ref") allocations ───────────────────────────────────
  const txns: any[] = await Transaction.find({
    adminid,
    status: { $ne: false },
    "invoices.invoiceid": { $in: invoiceIds },
  })
    .select("invoices")
    .lean();

  const settled: Record<string, number> = {};
  const addLines = (docs: any[]) => {
    docs.forEach((d) =>
      (d.invoices || []).forEach((line: any) => {
        if (!line?.invoiceid) return;
        const k = String(line.invoiceid);
        settled[k] = (settled[k] || 0) + (Number(line.settledamount) || 0);
      })
    );
  };
  addLines(payments);
  addLines(txns);

  // ── Returns not refunded in cash/bank ──────────────────────────────────
  const returns: any[] = await Return.find({
    adminid,
    status: true,
    sourceInvoiceId: { $in: invoiceIds },
  })
    .select("_id sourceInvoiceId totalamount")
    .lean();

  let refundedReturnIds = new Set<string>();
  if (returns.length) {
    const refundPays: any[] = await mongoose
      .model("Payment")
      .find({
        adminid,
        status: true,
        "invoices.invoiceid": { $in: returns.map((r) => r._id) },
        "invoices.invoicemodel": RETURN_MODEL[invoicemodel],
      })
      .select("invoices")
      .lean();
    refundPays.forEach((p) =>
      (p.invoices || []).forEach((l: any) => {
        if (l?.invoiceid) refundedReturnIds.add(String(l.invoiceid));
      })
    );
  }

  const returned: Record<string, number> = {};
  returns.forEach((r) => {
    if (refundedReturnIds.has(String(r._id))) return;
    const k = String(r.sourceInvoiceId);
    returned[k] = (returned[k] || 0) + (Number(r.totalamount) || 0);
  });

  const positions = invoices.map((inv) => {
    const k = String(inv._id);
    const net = (Number(inv.totalamount) || 0) - (settled[k] || 0) - (returned[k] || 0);
    return {
      id: k,
      billnumber: inv.billnumber || "",
      billdate: inv.billdate || "",
      duedate: inv.duedate || "",
      totalamount: round2(inv.totalamount),
      outstanding: round2(Math.max(0, net)),
      excess: round2(Math.max(0, -net)),
      invoicemodel,
    };
  });

  positions.sort((a, b) =>
    order === "lifo" ? b.billdate.localeCompare(a.billdate) : a.billdate.localeCompare(b.billdate)
  );
  return positions;
}

/** Open bills only — what a payment can actually be allocated against. */
export async function getPartyOutstandingBills(
  opts: Parameters<typeof getPartyBillPositions>[0]
): Promise<OutstandingBill[]> {
  const positions = await getPartyBillPositions(opts);
  return positions.filter((b) => b.outstanding > 0);
}

/**
 * Total credit sitting on this party's bills because returns came in AFTER the
 * bill was already settled. It belongs to them just like an unallocated
 * advance, so any party-level balance must subtract it.
 */
export async function getPartyExcessCredit(
  opts: Parameters<typeof getPartyBillPositions>[0]
): Promise<number> {
  const positions = await getPartyBillPositions(opts);
  return round2(positions.reduce((t, b) => t + b.excess, 0));
}

/**
 * Outstanding for ONE bill — same formula, but scoped to that invoice so a
 * listing can resolve it per row without recomputing the whole party.
 */
export async function getInvoiceOutstanding(opts: {
  invoiceid: any;
  invoicemodel: InvoiceModel;
  adminid?: any;
  excludePaymentId?: any;
}): Promise<number> {
  const { invoiceid, invoicemodel, excludePaymentId } = opts;
  if (!invoiceid) return 0;

  const Invoice = mongoose.model(invoicemodel);
  const inv: any = await Invoice.findById(invoiceid).select("totalamount").lean();
  if (!inv) return 0;

  const payQuery: any = { status: true, "invoices.invoiceid": invoiceid };
  if (excludePaymentId) payQuery._id = { $ne: excludePaymentId };

  const [payments, txns, returns] = await Promise.all([
    mongoose.model("Payment").find(payQuery).select("invoices").lean(),
    mongoose
      .model("Transaction")
      .find({ status: { $ne: false }, "invoices.invoiceid": invoiceid })
      .select("invoices")
      .lean(),
    mongoose
      .model(RETURN_MODEL[invoicemodel])
      .find({ status: true, sourceInvoiceId: invoiceid })
      .select("_id totalamount")
      .lean(),
  ]);

  let settled = 0;
  [...(payments as any[]), ...(txns as any[])].forEach((d: any) =>
    (d.invoices || []).forEach((l: any) => {
      if (String(l.invoiceid) === String(invoiceid)) settled += Number(l.settledamount) || 0;
    })
  );

  let returned = 0;
  if ((returns as any[]).length) {
    const refunded: any[] = await mongoose
      .model("Payment")
      .find({
        status: true,
        "invoices.invoiceid": { $in: (returns as any[]).map((r: any) => r._id) },
        "invoices.invoicemodel": RETURN_MODEL[invoicemodel],
      })
      .select("invoices")
      .lean();
    const refundedIds = new Set<string>();
    refunded.forEach((p: any) =>
      (p.invoices || []).forEach((l: any) => {
        if (l?.invoiceid) refundedIds.add(String(l.invoiceid));
      })
    );
    (returns as any[]).forEach((r: any) => {
      // Refunded in cash → the two legs cancel, so the bill still stands.
      if (!refundedIds.has(String(r._id))) returned += Number(r.totalamount) || 0;
    });
  }

  return round2(Math.max(0, (Number(inv.totalamount) || 0) - settled - returned));
}

export type AllocationLine = {
  invoiceid: string;
  invoicemodel: InvoiceModel;
  settledamount: number;
  discount: number;
  commission: number;
  allocatedmode: "manual" | "auto_fifo";
};

/**
 * Spread `amount` across `bills` in the order given, filling each bill fully
 * before moving to the next and part-filling the last one. Concessions are
 * always zero: the machine cannot know which bill deserves a discount, so the
 * user must switch to manual allocation for that.
 */
export function fifoAllocate(
  bills: OutstandingBill[],
  amount: number
): { lines: AllocationLine[]; unallocated: number } {
  const lines: AllocationLine[] = [];
  let left = round2(amount);

  for (const bill of bills) {
    if (left <= 0) break;
    const take = round2(Math.min(left, bill.outstanding));
    if (take <= 0) continue;
    lines.push({
      invoiceid: bill.id,
      invoicemodel: bill.invoicemodel,
      settledamount: take,
      discount: 0,
      commission: 0,
      allocatedmode: "auto_fifo",
    });
    left = round2(left - take);
  }

  return { lines, unallocated: left };
}

/**
 * Reject an allocation that would clear more than a bill actually owes.
 *
 * The client already caps each row, but two users settling the same invoice at
 * the same time would both pass that check and the bill would end up
 * over-paid. Throws on the first offending line.
 */
export async function assertAllocationsFit(opts: {
  invoices: any[];
  adminid: any;
  excludePaymentId?: any;
}): Promise<void> {
  const { invoices, adminid, excludePaymentId } = opts;
  const lines = (invoices || []).filter(
    (l: any) => l?.invoicemodel === "SalesInvoice" || l?.invoicemodel === "PurchaseInvoice"
  );
  if (!lines.length) return;

  // Group by model so each party's bill list is fetched once.
  for (const model of ["SalesInvoice", "PurchaseInvoice"] as InvoiceModel[]) {
    const group = lines.filter((l: any) => l.invoicemodel === model);
    if (!group.length) continue;

    const Invoice = mongoose.model(model);
    const invs: any[] = await Invoice.find({ _id: { $in: group.map((l: any) => l.invoiceid) } })
      .select("_id partyacc billnumber")
      .lean();

    const partyIds = [...new Set(invs.map((i) => String(i.partyacc)))];
    const billMap = new Map<string, OutstandingBill>();
    for (const pid of partyIds) {
      const bills = await getPartyOutstandingBills({
        partyid: pid,
        invoicemodel: model,
        adminid,
        excludePaymentId,
      });
      bills.forEach((b) => billMap.set(b.id, b));
    }

    for (const line of group) {
      const want = round2(line.settledamount);
      if (want <= 0) continue;
      const key = String(line.invoiceid);
      const available = billMap.get(key)?.outstanding ?? 0;
      // 1 paisa tolerance for rounding drift between client and server.
      if (want > available + 0.01) {
        const label = invs.find((i) => String(i._id) === key)?.billnumber || key;
        throw new Error(
          `Bill ${label} me sirf ₹${available.toFixed(2)} baaki hai — ₹${want.toFixed(2)} settle nahi ho sakta. Page refresh karke dobara koshish karein.`
        );
      }
    }
  }
}

/**
 * Cash that arrived but isn't tied to any bill (Tally's "On Account").
 *
 * `amount` is the cash that moved. The bills cleared can differ from it when
 * concessions are in play: cash = settled − discount + commission. Anything
 * left over is unallocated and shows up on the party's ledger as a credit
 * waiting to be applied.
 */
export function computeUnallocated(input: any): number {
  const lines = Array.isArray(input?.invoices) ? input.invoices : [];
  const settled = lines.reduce((s: number, i: any) => s + (Number(i.settledamount) || 0), 0);
  const discount = lines.reduce((s: number, i: any) => s + (Number(i.discount) || 0), 0);
  const commission = lines.reduce((s: number, i: any) => s + (Number(i.commission) || 0), 0);
  const cashApplied = settled - discount + commission + (Number(input?.openingsettled) || 0);
  return round2(Math.max(0, (Number(input?.amount) || 0) - cashApplied));
}

/**
 * Apply a party's outstanding advances to a freshly created invoice.
 *
 * Called from the sales/purchase invoice models after the invoice is saved.
 * Purely an allocation shift — the party ledger was already credited when the
 * advance was received, so NO journal entry is created here. That mirrors
 * Tally's bill-adjustment journal, which is deliberately net-zero.
 *
 * Best-effort by design: a failure here must never roll back a valid invoice.
 */
export async function autoAdjustAdvances(opts: {
  invoiceid: any;
  invoicemodel: InvoiceModel;
  partyid: any;
  adminid: any;
}): Promise<number> {
  const { invoiceid, invoicemodel, partyid, adminid } = opts;
  if (!partyid || !invoiceid) return 0;

  // Work from what the bill STILL owes, not its face value. A cash invoice is
  // already settled by its own auto-payment, so there is nothing left for an
  // advance to cover — using totalamount here would double-settle it.
  const outstanding = await getInvoiceOutstanding({ invoiceid, invoicemodel, adminid });
  if (outstanding <= 0) return 0;

  const Payment = mongoose.model("Payment");
  const wantType = invoicemodel === "SalesInvoice" ? "receipt" : "payment";

  const advances: any[] = await Payment.find({
    adminid,
    partyid,
    status: true,
    type: wantType,
    unallocatedamount: { $gt: 0 },
  })
    .sort({ paymentdate: 1, createdAt: 1 })
    .select("_id unallocatedamount invoices")
    .lean();
  if (!advances.length) return 0;

  let remaining = round2(outstanding);
  let applied = 0;

  for (const adv of advances) {
    if (remaining <= 0) break;
    const take = round2(Math.min(remaining, Number(adv.unallocatedamount) || 0));
    if (take <= 0) continue;

    await Payment.updateOne(
      { _id: adv._id },
      {
        $push: {
          invoices: {
            invoiceid,
            invoicemodel,
            settledamount: take,
            discount: 0,
            commission: 0,
            allocatedmode: "auto_fifo",
            allocatedat: new Date(),
          },
        },
        $set: { unallocatedamount: round2((Number(adv.unallocatedamount) || 0) - take) },
      }
    );

    remaining = round2(remaining - take);
    applied = round2(applied + take);
  }

  return applied;
}

/**
 * What is still owed on the party's OPENING BALANCE — the amount they carried
 * in before the first invoice was ever raised.
 *
 * This is not a bill, so nothing in `Payment.invoices[]` can point at it. That
 * used to make an advance look larger than the party's real credit: pay ₹250 to
 * a party with a ₹100 opening and one ₹100 bill and the screen said "₹150 on
 * account" while the ledger said they were only ₹50 up. The ₹100 opening had no
 * way of being cleared. `Payment.openingsettled` closes that gap.
 *
 * Sign convention matches the party report: a DEBIT opening on a customer means
 * they owe us. A vendor's balance runs the other way, so it is flipped.
 */
export async function getPartyOpeningDue(opts: {
  partyid: any;
  excludePaymentId?: any;
}): Promise<number> {
  const { partyid, excludePaymentId } = opts;
  if (!partyid) return 0;

  const acc: any = await mongoose
    .model("Account")
    .findById(partyid)
    .select("ledgerid openingbalance openingbalancetype type")
    .lean();
  if (!acc) return 0;

  // The ledger is authoritative when the party has one; the account's own
  // opening is the fallback. Same order the party report uses.
  const led: any = acc.ledgerid
    ? await mongoose
        .model("AccountLedger")
        .findById(acc.ledgerid)
        .select("openingbalance openingbalancetype")
        .lean()
    : null;
  const src = led || acc;

  let opening =
    String(src.openingbalancetype).toLowerCase() === "debit"
      ? Number(src.openingbalance) || 0
      : -(Number(src.openingbalance) || 0);
  if (String(acc.type).toLowerCase() === "vendor") opening = -opening;

  // A credit opening means WE owe THEM — there is nothing to collect.
  if (opening <= 0) return 0;

  const payQuery: any = { partyid, status: true };
  if (excludePaymentId) payQuery._id = { $ne: excludePaymentId };
  const pays: any[] = await mongoose
    .model("Payment")
    .find(payQuery)
    .select("openingsettled")
    .lean();
  const already = pays.reduce((t, p) => t + (Number(p.openingsettled) || 0), 0);

  return round2(Math.max(0, opening - already));
}

/**
 * Everything this party still owes, on exactly the same basis a payment is
 * allocated: opening balance + open bills − money already sitting with us.
 *
 *     due = opening still due
 *         + Σ open bill outstanding
 *         − unallocated advances (cash received, no bill to put it on)
 *         − excess credit (returns that arrived after the bill was settled)
 *
 * ── Why this replaced the bill-wise-only figure ─────────────────────────────
 * The portal and the app showed "Due" as the sum of open BILLS only, while
 * `allocateWithOpening` deliberately clears the OPENING balance first. A party
 * with a ₹1,000 opening and one ₹250 bill was shown "₹250 Due"; they paid
 * ₹250, FIFO put it on the opening (correctly — that is the older debt), and
 * the screen still said "₹250 Due". Paying the number on the screen must clear
 * the number on the screen, so the display now uses the same basis as the
 * allocation.
 *
 * Advances are netted for the same reason: money we are already holding is not
 * something to ask for again.
 */
export async function getPartyTotalDue(opts: {
  partyid: any;
  invoicemodel?: InvoiceModel;
  adminid?: any;
  branchid?: any;
  excludePaymentId?: any;
  /** Leave one bill out entirely — the printed "Previous Balance". */
  excludeInvoiceId?: any;
}): Promise<number> {
  const { partyid, adminid, branchid, excludePaymentId, excludeInvoiceId } = opts;
  if (!partyid) return 0;
  const invoicemodel = opts.invoicemodel || "SalesInvoice";

  const [positions, openingdue] = await Promise.all([
    getPartyBillPositions({ partyid, invoicemodel, adminid, branchid, excludePaymentId, excludeInvoiceId }),
    getPartyOpeningDue({ partyid, excludePaymentId }),
  ]);

  const bills = round2(positions.reduce((t, b) => t + b.outstanding, 0));
  const excess = round2(positions.reduce((t, b) => t + b.excess, 0));

  const payQuery: any = {
    partyid,
    status: true,
    type: invoicemodel === "SalesInvoice" ? "receipt" : "payment",
    unallocatedamount: { $gt: 0 },
  };
  if (adminid) payQuery.adminid = adminid;
  if (excludePaymentId) payQuery._id = { $ne: excludePaymentId };
  const advances: any[] = await mongoose
    .model("Payment")
    .find(payQuery)
    .select("unallocatedamount")
    .lean();
  const advance = round2(advances.reduce((t, p) => t + (Number(p.unallocatedamount) || 0), 0));

  return round2(Math.max(0, openingdue + bills - advance - excess));
}

/**
 * Spread an amount over the opening balance FIRST, then the open bills.
 *
 * Tally enters an opening balance as a bill reference precisely so advances can
 * settle it. We don't have that reference, so the opening is handled as a
 * separate leg and reported alongside the bill lines.
 */
export async function allocateWithOpening(opts: {
  partyid: any;
  invoicemodel: InvoiceModel;
  adminid?: any;
  branchid?: any;
  amount: number;
  excludePaymentId?: any;
  order?: "fifo" | "lifo";
  /**
   * A bill this money was explicitly collected against — cash-on-delivery for
   * the invoice being handed over. It is filled BEFORE the opening balance,
   * because "here is the money for this delivery" must not silently go to an
   * older debt. Everything left over then follows the normal opening→FIFO path.
   */
  priorityInvoiceId?: any;
}): Promise<{
  openingdue: number;
  openingsettled: number;
  bills: OutstandingBill[];
  lines: AllocationLine[];
  allocated: number;
  unallocated: number;
}> {
  const {
    partyid, invoicemodel, adminid, branchid, amount,
    excludePaymentId, order, priorityInvoiceId,
  } = opts;

  const bills = await getPartyOutstandingBills({
    partyid, invoicemodel, adminid, branchid, excludePaymentId, order,
  });

  let left = round2(amount);
  const lines: AllocationLine[] = [];

  const priorityKey = priorityInvoiceId ? String(priorityInvoiceId) : "";
  if (priorityKey) {
    const bill = bills.find((b) => b.id === priorityKey);
    if (bill) {
      const take = round2(Math.min(left, bill.outstanding));
      if (take > 0) {
        lines.push({
          invoiceid: bill.id,
          invoicemodel: bill.invoicemodel,
          settledamount: take,
          discount: 0,
          commission: 0,
          allocatedmode: "auto_fifo",
        });
        left = round2(left - take);
      }
    }
  }

  const openingdue = await getPartyOpeningDue({ partyid, excludePaymentId });
  const openingsettled = round2(Math.min(left, openingdue));
  left = round2(left - openingsettled);

  const rest = priorityKey ? bills.filter((b) => b.id !== priorityKey) : bills;
  const { lines: fifoLines, unallocated } = fifoAllocate(rest, left);
  lines.push(...fifoLines);

  return {
    openingdue,
    openingsettled,
    bills,
    lines,
    allocated: round2(amount - unallocated),
    unallocated,
  };
}
