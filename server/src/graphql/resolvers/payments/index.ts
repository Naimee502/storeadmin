import mongoose from "mongoose";
import { Payment } from "../../../models/payments";
import { Account } from "../../../models/accounts";
import { AccountLedger } from "../../../models/accountledgers";
import { Transaction } from "../../../models/transactions";
import { AccountGroup } from "../../../models/accountgroups";
import { ExpenseNote } from "../../../models/expensenote";
import { StaffAccount } from "../../../models/staffaccounts";
import { pushNotification } from "../../../models/notifications";
import { AdminSettings } from "../../../models/adminsettings";
import {
  getPartyOutstandingBills,
  allocateWithOpening,
  assertAllocationsFit,
  computeUnallocated,
  type InvoiceModel,
} from "../../../utils/allocation";

// Find (or auto-create) a posting LEDGER by name under a given account group.
// Used for the optional Discount / Commission concessions on a payment. Creates
// the AccountLedger (and its group) directly — never an Account — so we don't hit
// the Account.type enum.
async function getOrCreateLedgerId(
  name: string,
  groupName: string,
  category: "expenses" | "income",
  adminid: any
): Promise<any> {
  const existing = await AccountLedger.findOne({ ledgername: name, admin: adminid });
  if (existing) return existing._id;

  let group: any = await AccountGroup.findOne({ accountgroupname: groupName, admin: adminid });
  if (!group) {
    group = await AccountGroup.create({ admin: adminid, accountgroupname: groupName, category, status: true });
  }
  const led: any = await AccountLedger.create({
    admin: adminid,
    accountgroupid: group._id,
    ledgername: name,
    openingbalance: 0,
    openingbalancetype: category === "income" ? "credit" : "debit",
    status: true,
  });
  return led._id;
}

// Recursively collect party ids under a root party (assignaccountid chain),
// for channel downline payment visibility.
async function getDownlinePartyIds(rootId: any): Promise<string[]> {
  const out: string[] = [];
  let frontier = [String(rootId)];
  for (let depth = 0; depth < 6 && frontier.length; depth++) {
    const children = await Account.find({ assignaccountid: { $in: frontier }, status: true })
      .select("_id")
      .lean();
    const ids = children.map((c: any) => c._id.toString()).filter((id) => !out.includes(id));
    if (!ids.length) break;
    out.push(...ids);
    frontier = ids;
  }
  return out;
}

// Build balanced journal entries for a payment/receipt.
//
// Plain payment (no concessions): Dr Cash · Cr Party (receipt) or reverse.
//
// With per-invoice Discount / Commission (feature-flagged in the UI): the bill
// is fully cleared while cash received is lower. The receivable/payable cleared
// (party leg) = sum of settledamount; cash = that minus discount + commission;
// the difference posts to "Discount Allowed" / "Commission" so the journal still
// balances. Returns { entries, totaldebit, totalcredit } (totals computed from
// the entries themselves, so callers never have to recompute).
async function buildPaymentEntries(input: any, partyAccount: any) {
  const partyLedgerId = partyAccount?.ledgerid;
  const cashBankLedgerId = input.ledgerid;
  if (!partyLedgerId || !cashBankLedgerId) return null;

  const partyName = partyAccount?.name || "Party";
  const invs = Array.isArray(input.invoices) ? input.invoices : [];

  const totalDiscount = parseFloat(invs.reduce((s: number, i: any) => s + (Number(i.discount) || 0), 0).toFixed(2));
  const totalCommission = parseFloat(invs.reduce((s: number, i: any) => s + (Number(i.commission) || 0), 0).toFixed(2));

  // Cash actually moved. This is the amount on the payment, full stop.
  const cashLeg = parseFloat((Number(input.amount) || 0).toFixed(2));

  // Party leg = the WHOLE reduction in what the party owes.
  //
  // It used to be the sum of settledamount whenever any bill was selected. That
  // held only while the amount was always equal to what got allocated. Once a
  // receipt could clear the opening balance or leave money on account, a ₹250
  // receipt allocating ₹100 to one bill posted only "Dr Cash 100 / Cr Party 100"
  // — ₹150 of real cash never reached the books, and the ledger drifted from the
  // payment record.
  //
  // Cash lowers the balance by its full value wherever it lands (bill, opening,
  // or on account). A discount lowers it further (we absorbed part of the bill);
  // a commission raises what they owe, so it comes back off.
  //
  //   Dr Cash      amount
  //   Dr Discount  discount
  //     Cr Party     amount + discount − commission
  //     Cr Commission            commission
  const settledTotal = parseFloat((cashLeg + totalDiscount - totalCommission).toFixed(2));

  const entries: any[] = [];

  if (input.type === "receipt") {
    // Money in: Dr Cash + Dr Discount Allowed · Cr Customer + Cr Commission Received
    entries.push({ ledgerid: cashBankLedgerId, debit: cashLeg, credit: 0, remarks: `Receipt from ${partyName}` });
    if (totalDiscount > 0) {
      const lid = await getOrCreateLedgerId("Discount Allowed", "Indirect Expenses", "expenses", input.adminid);
      if (lid) entries.push({ ledgerid: lid, debit: totalDiscount, credit: 0, remarks: `Discount allowed to ${partyName}` });
    }
    entries.push({ ledgerid: partyLedgerId, debit: 0, credit: settledTotal, remarks: `Settlement by ${partyName}` });
    if (totalCommission > 0) {
      const lid = await getOrCreateLedgerId("Commission Received", "Indirect Income", "income", input.adminid);
      if (lid) entries.push({ ledgerid: lid, debit: 0, credit: totalCommission, remarks: `Commission charged to ${partyName}` });
    }
  } else {
    // Money out: Dr Vendor + Dr Commission · Cr Cash + Cr Discount Received
    entries.push({ ledgerid: partyLedgerId, debit: settledTotal, credit: 0, remarks: `Payment to ${partyName}` });
    if (totalCommission > 0) {
      const lid = await getOrCreateLedgerId("Commission", "Commission Expense", "expenses", input.adminid);
      if (lid) entries.push({ ledgerid: lid, debit: totalCommission, credit: 0, remarks: `Commission on payment to ${partyName}` });
    }
    entries.push({ ledgerid: cashBankLedgerId, debit: 0, credit: cashLeg, remarks: `Payment to ${partyName}` });
    if (totalDiscount > 0) {
      const lid = await getOrCreateLedgerId("Discount Received", "Indirect Income", "income", input.adminid);
      if (lid) entries.push({ ledgerid: lid, debit: 0, credit: totalDiscount, remarks: `Discount received from ${partyName}` });
    }
  }

  const totaldebit = parseFloat(entries.reduce((t, e) => t + (e.debit || 0), 0).toFixed(2));
  const totalcredit = parseFloat(entries.reduce((t, e) => t + (e.credit || 0), 0).toFixed(2));
  return { entries, totaldebit, totalcredit };
}

// Build journal entries for an EXPENSE settlement that has no linked party
// account. A credit expense note posts "Cr <payable ledger>"; settling it must
// reverse that leg: Dr <expense note's payable ledger> · Cr Cash/Bank. We read
// the ledger straight off each settled ExpenseNote so it works even when the
// payable ledger isn't attached to a party Account (e.g. Staff Salary).
async function buildExpenseSettlementEntries(input: any) {
  const cashBankLedgerId = input.ledgerid;
  if (!cashBankLedgerId) return null;

  const invs = (Array.isArray(input.invoices) ? input.invoices : [])
    .filter((i: any) => i.invoicemodel === "ExpenseNote");
  if (!invs.length) return null;

  const entries: any[] = [];
  let total = 0;

  for (const i of invs) {
    const note: any = await ExpenseNote.findById(i.invoiceid).select("ledgerid expensenumber").lean();
    const payableLedgerId = note?.ledgerid;
    const amt = Number(i.settledamount) || 0;
    if (!payableLedgerId || amt <= 0) continue;
    entries.push({
      ledgerid: payableLedgerId,
      debit: amt,
      credit: 0,
      remarks: `Settle expense ${note?.expensenumber || ""}`.trim(),
    });
    total += amt;
  }

  if (!entries.length) return null;
  total = parseFloat(total.toFixed(2));
  entries.push({ ledgerid: cashBankLedgerId, debit: 0, credit: total, remarks: "Expense payment" });
  return { entries, totaldebit: total, totalcredit: total };
}

/**
 * Build journal entries for a payment whose other side is a LEDGER, not a
 * party — Tally's Receipt / Payment voucher, where the counter leg can be any
 * ledger at all: Capital introduced, a loan taken or repaid, rent, salary,
 * interest received, a bank charge, cash moved to the bank.
 *
 *   Receipt (money in)  →  Dr Cash/Bank · Cr <counter ledger>
 *   Payment (money out) →  Dr <counter ledger> · Cr Cash/Bank
 *
 * There is no party, so there are no bills, no discount and no commission —
 * just the two legs. This is what a payment with neither a party nor an
 * expense note used to be missing: it saved, but no Transaction was ever
 * written, so the cash ledger never moved.
 */
async function buildLedgerEntries(input: any) {
  const counterLedgerId = input.counterledgerid;
  const cashBankLedgerId = input.ledgerid;
  if (!counterLedgerId || !cashBankLedgerId) return null;

  const cashLeg = parseFloat((Number(input.amount) || 0).toFixed(2));
  if (cashLeg <= 0) return null;

  const led: any = await AccountLedger.findById(counterLedgerId).select("ledgername").lean();
  const name = led?.ledgername || "Ledger";

  // Same arithmetic as a party settlement, with this ledger standing in for the
  // party: the balance knocked off is the cash PLUS any discount allowed, LESS
  // any commission charged on top.
  //
  //   Dr Cash      amount
  //   Dr Discount  discount
  //     Cr Ledger    amount + discount − commission
  //     Cr Commission            commission
  const discount = parseFloat((Number(input.discount) || 0).toFixed(2));
  const commission = parseFloat((Number(input.commission) || 0).toFixed(2));
  const settledTotal = parseFloat((cashLeg + discount - commission).toFixed(2));

  const entries: any[] = [];

  if (input.type === "receipt") {
    entries.push({ ledgerid: cashBankLedgerId, debit: cashLeg, credit: 0, remarks: `Receipt — ${name}` });
    if (discount > 0) {
      const lid = await getOrCreateLedgerId("Discount Allowed", "Indirect Expenses", "expenses", input.adminid);
      if (lid) entries.push({ ledgerid: lid, debit: discount, credit: 0, remarks: `Discount allowed — ${name}` });
    }
    entries.push({ ledgerid: counterLedgerId, debit: 0, credit: settledTotal, remarks: `Receipt — ${name}` });
    if (commission > 0) {
      const lid = await getOrCreateLedgerId("Commission Received", "Indirect Income", "income", input.adminid);
      if (lid) entries.push({ ledgerid: lid, debit: 0, credit: commission, remarks: `Commission — ${name}` });
    }
  } else {
    entries.push({ ledgerid: counterLedgerId, debit: settledTotal, credit: 0, remarks: `Payment — ${name}` });
    if (commission > 0) {
      const lid = await getOrCreateLedgerId("Commission", "Commission Expense", "expenses", input.adminid);
      if (lid) entries.push({ ledgerid: lid, debit: commission, credit: 0, remarks: `Commission — ${name}` });
    }
    entries.push({ ledgerid: cashBankLedgerId, debit: 0, credit: cashLeg, remarks: `Payment — ${name}` });
    if (discount > 0) {
      const lid = await getOrCreateLedgerId("Discount Received", "Indirect Income", "income", input.adminid);
      if (lid) entries.push({ ledgerid: lid, debit: 0, credit: discount, remarks: `Discount received — ${name}` });
    }
  }

  const totaldebit = parseFloat(entries.reduce((t, e) => t + (e.debit || 0), 0).toFixed(2));
  const totalcredit = parseFloat(entries.reduce((t, e) => t + (e.credit || 0), 0).toFixed(2));
  return { entries, totaldebit, totalcredit };
}

function formatPayment(r: any) {
  return {
    ...r,
    id: r._id.toString(),
    ledgerid: r.ledgerid ? { ...r.ledgerid, id: r.ledgerid._id?.toString() } : null,
    counterledgerid: r.counterledgerid
      ? { ...r.counterledgerid, id: r.counterledgerid._id?.toString() }
      : null,
    partyid: r.partyid ? { ...r.partyid, id: r.partyid._id?.toString() } : null,
  };
}

// Allocation order comes from AdminSettings (FIFO by default — oldest bill first).
async function allocationOrder(adminid: any): Promise<"fifo" | "lifo"> {
  try {
    const st: any = await AdminSettings.getOrCreateForAdmin(adminid);
    return st?.paymentAllocationOrder === "lifo" ? "lifo" : "fifo";
  } catch {
    return "fifo";
  }
}

// Everything that must be true of an allocation before it is written:
// no bill may be over-settled, and the unallocated remainder is derived on the
// server rather than trusted from the client.
async function prepareAllocation(input: any, excludePaymentId?: any) {
  await assertAllocationsFit({
    invoices: input.invoices,
    adminid: input.adminid,
    excludePaymentId,
  });

  const lines = Array.isArray(input.invoices) ? input.invoices : [];
  const stamped = lines.map((l: any) => ({
    ...l,
    allocatedmode: l.allocatedmode === "auto_fifo" ? "auto_fifo" : "manual",
    allocatedat: new Date(),
  }));

  const unallocatedamount = computeUnallocated(input);
  // Payment-level concession totals. Derived on the SERVER so they can never
  // disagree with the lines: Σ of the bill lines, or the client's figures when
  // there are no lines at all (Ledger mode).
  const lineDiscount = parseFloat(
    lines.reduce((t: number, l: any) => t + (Number(l.discount) || 0), 0).toFixed(2)
  );
  const lineCommission = parseFloat(
    lines.reduce((t: number, l: any) => t + (Number(l.commission) || 0), 0).toFixed(2)
  );
  const discount = lines.length ? lineDiscount : parseFloat((Number(input.discount) || 0).toFixed(2));
  const commission = lines.length
    ? lineCommission
    : parseFloat((Number(input.commission) || 0).toFixed(2));
  const openingsettled = parseFloat((Number(input.openingsettled) || 0).toFixed(2));
  // No bill lines at all → the money went on account and/or straight onto the
  // opening balance. Neither is an "Invoice-wise" settlement, so it must never
  // fall through to "manual": a payment that only cleared the opening balance
  // used to be labelled Invoice-wise in Manage Payments even though the user
  // had explicitly picked Direct / On Account.
  const allocationmode = !stamped.length
    ? "on_account"
    : stamped.some((l: any) => l.allocatedmode === "auto_fifo")
    ? "auto_fifo"
    : "manual";

  return {
    ...input,
    invoices: stamped,
    openingsettled,
    unallocatedamount,
    allocationmode,
    discount,
    commission,
  };
}

export const paymentResolvers = {
  Query: {
    getPayments: async (_: any, args: { filter?: any }, context: any) => {
      const filter = args.filter || {};
      const query: any = { status: true };
      const { user } = context;

      if (user?.type === "branch") {
        query.$or = [
          { createdby_type: "branch", createdby_id: user?.id },
          { branchid: user?.branch_id || user?.id },
        ];
      } else if (user?.type === "staff") {
        query.createdby_id = user?.id;
      }

      if (filter.adminid) query.adminid = new mongoose.Types.ObjectId(filter.adminid);
      if (filter.branchid) query.branchid = new mongoose.Types.ObjectId(filter.branchid);
      if (filter.type) query.type = filter.type;
      if (filter.partyid) {
        if (filter.includeDownline) {
          const downline = await getDownlinePartyIds(filter.partyid);
          query.partyid = { $in: [filter.partyid, ...downline].map((x: any) => new mongoose.Types.ObjectId(x)) };
        } else {
          query.partyid = new mongoose.Types.ObjectId(filter.partyid);
        }
      }
      if (filter.ledgerid) query.ledgerid = new mongoose.Types.ObjectId(filter.ledgerid);
      if (filter.counterledgerid)
        query.counterledgerid = new mongoose.Types.ObjectId(filter.counterledgerid);
      if (filter.paymentcode) query.paymentcode = { $regex: filter.paymentcode, $options: "i" };
      if (typeof filter.status === "boolean") query.status = filter.status;
      if (filter.dateFrom || filter.dateTo) {
        query.paymentdate = {};
        if (filter.dateFrom) query.paymentdate.$gte = new Date(filter.dateFrom);
        if (filter.dateTo) query.paymentdate.$lte = new Date(filter.dateTo);
      }

      const result = await Payment.find(query).populate("ledgerid").populate("counterledgerid").populate("partyid").lean();
      return result.map(formatPayment);
    },

    getDeletedPayments: async (_: any, args: { filter?: any }, context: any) => {
      const filter = args.filter || {};
      const query: any = { status: false };
      const { user } = context;

      if (user?.type === "branch") {
        query.$or = [
          { createdby_type: "branch", createdby_id: user?.id },
          { branchid: user?.branch_id || user?.id },
        ];
      } else if (user?.type === "staff") {
        query.createdby_id = user?.id;
      }

      if (filter.adminid) query.adminid = new mongoose.Types.ObjectId(filter.adminid);
      if (filter.branchid) query.branchid = new mongoose.Types.ObjectId(filter.branchid);
      if (filter.type) query.type = filter.type;
      if (filter.partyid) {
        if (filter.includeDownline) {
          const downline = await getDownlinePartyIds(filter.partyid);
          query.partyid = { $in: [filter.partyid, ...downline].map((x: any) => new mongoose.Types.ObjectId(x)) };
        } else {
          query.partyid = new mongoose.Types.ObjectId(filter.partyid);
        }
      }
      if (filter.ledgerid) query.ledgerid = new mongoose.Types.ObjectId(filter.ledgerid);
      if (filter.counterledgerid)
        query.counterledgerid = new mongoose.Types.ObjectId(filter.counterledgerid);
      if (filter.paymentcode) query.paymentcode = { $regex: filter.paymentcode, $options: "i" };
      if (filter.dateFrom || filter.dateTo) {
        query.paymentdate = {};
        if (filter.dateFrom) query.paymentdate.$gte = new Date(filter.dateFrom);
        if (filter.dateTo) query.paymentdate.$lte = new Date(filter.dateTo);
      }

      const result = await Payment.find(query).populate("partyid").populate("ledgerid").populate("counterledgerid").lean();
      return result.map(formatPayment);
    },

    // Open bills for a party — server-computed so a stale client cache can
    // never show an already-settled invoice as payable.
    getPartyOutstandingBills: async (_: any, args: any) => {
      const order = await allocationOrder(args.adminid);
      return getPartyOutstandingBills({
        partyid: args.partyid,
        invoicemodel: args.invoicemodel as InvoiceModel,
        adminid: args.adminid,
        branchid: args.branchid,
        excludePaymentId: args.excludePaymentId,
        order,
      });
    },

    // Dry run: "if I take ₹X from this party, which bills does it clear?"
    // Drives the confirmation dialog — the user sees the spread and approves
    // it, so nothing is ever settled behind their back.
    previewAllocation: async (_: any, args: any) => {
      const order = await allocationOrder(args.adminid);
      // Opening balance is cleared before any bill — otherwise an advance keeps
      // showing as "on account" while the ledger says the party owes less.
      const { openingdue, openingsettled, bills, lines, unallocated } =
        await allocateWithOpening({
          partyid: args.partyid,
          invoicemodel: args.invoicemodel as InvoiceModel,
          adminid: args.adminid,
          branchid: args.branchid,
          amount: args.amount,
          excludePaymentId: args.excludePaymentId,
          priorityInvoiceId: args.priorityInvoiceId,
          order,
        });
      const byId = new Map(bills.map((b) => [b.id, b]));
      const totaloutstanding = parseFloat(
        (bills.reduce((t, b) => t + b.outstanding, 0) + openingdue).toFixed(2)
      );
      return {
        openingdue,
        openingsettled,
        lines: lines.map((l) => {
          const bill = byId.get(l.invoiceid);
          return {
            invoiceid: l.invoiceid,
            invoicemodel: l.invoicemodel,
            billnumber: bill?.billnumber || "",
            billdate: bill?.billdate || "",
            outstanding: bill?.outstanding || 0,
            settledamount: l.settledamount,
            fullysettled: (bill?.outstanding || 0) - l.settledamount <= 0.01,
          };
        }),
        totaloutstanding,
        allocated: parseFloat((Number(args.amount) - unallocated).toFixed(2)),
        unallocated,
      };
    },

    getPaymentById: async (_: any, args: { id: string; adminid?: string }) => {
      if (!args.id) return null;
      const query: any = { _id: new mongoose.Types.ObjectId(args.id) };
      if (args.adminid) query.adminid = new mongoose.Types.ObjectId(args.adminid);
      const payment = await Payment.findOne(query).populate("partyid").populate("ledgerid").populate("counterledgerid").lean();
      if (!payment) return null;
      return formatPayment(payment);
    },
  },

  Mutation: {
    addPayment: async (_: any, { input }: any, context: any) => {
      const { user } = context;
      const createdbyData = {
        createdby_id: user?.id,
        createdby_name: input.createdby_name || user?.name || user?.email,
        createdby_type: user?.type || input.createdby_type || "admin",
      };
      // Staff token → resolve the real role (salesman/staff/deliveryboy) + name.
      if (user?.type === "staff") {
        try {
          const staff: any = await StaffAccount.findById(user.id).select("role name").lean();
          if (staff) {
            createdbyData.createdby_type = staff.role || "staff";
            createdbyData.createdby_name = createdbyData.createdby_name || staff.name;
          }
        } catch (e) { /* best-effort */ }
      }
      // Unidentifiable actor (expired/missing token, no input fallback): don't
      // assume "admin" — that would wrongly skip the admin notification.
      if (!user && !input.createdby_type && !input.createdby_name) {
        createdbyData.createdby_type = "unknown";
        createdbyData.createdby_name = "Unknown user";
      }

      const prepared = await prepareAllocation(input);
      const created = await Payment.create({ ...prepared, ...createdbyData });

      // ✅ Create journal entry. Party-based payment/receipt when a party + its
      // ledger exist; otherwise fall back to an expense-note settlement journal
      // (no party account required).
      let built: { entries: any[]; totaldebit: number; totalcredit: number } | null = null;
      if (input.partyid && input.ledgerid) {
        const partyAccount = await Account.findById(input.partyid).select("ledgerid name").lean();
        if (partyAccount?.ledgerid) {
          built = await buildPaymentEntries(input, partyAccount);
        }
      }
      if (!built && input.ledgerid) {
        built = await buildExpenseSettlementEntries(input);
      }
      // No party and no expense note — the other side is a plain ledger
      // (Capital, Loan, Rent, Salary, Interest, a bank charge).
      if (!built) {
        built = await buildLedgerEntries(input);
      }
      if (built) {
        const trx = await Transaction.create({
          adminid: input.adminid,
          branchid: input.branchid,
          entrytype: "manual",
          source: { docmodel: "Payment", docid: created._id },
          transactiondate: input.paymentdate || new Date(),
          narration: `Payment ${created.paymentcode || ""}`,
          entries: built.entries,
          totaldebit: built.totaldebit,
          totalcredit: built.totalcredit,
          ...createdbyData,
        });
        await Payment.findByIdAndUpdate(created._id, { transactionid: trx._id });
      }

      const populated = await Payment.findById(created._id).populate("ledgerid").populate("counterledgerid").populate("partyid").lean();
      if (!populated) throw new Error("Payment not found after creation");

      // ── Notifications ──────────────────────────────────────────
      // Actor ≠ admin → tell admin. Always tell the party's linked salesman and
      // the party — skipping whoever recorded the payment themselves.
      try {
        const p: any = populated;
        const partyName = p?.partyid?.name || "Party";
        const amount = Number(p?.amount || 0).toFixed(2);
        const isReceipt = String(p?.type || "").toLowerCase() === "receipt";
        const verb = isReceipt ? "collected from" : "paid to";
        const actorLabel = `${createdbyData.createdby_name || "Unknown user"} (${createdbyData.createdby_type})`;
        const detail = `${p?.paymentcode || ""} • ${p?.mode || ""} • by ${actorLabel}`;

        if (createdbyData.createdby_type !== "admin") {
          await pushNotification({
            adminid: input.adminid,
            branchid: input.branchid,
            targettype: "admin",
            ntype: "payment",
            title: `Payment ₹${amount} ${verb} ${partyName}`,
            message: detail,
            webpath: "/payments",
            docmodel: "Payment",
            docid: created._id,
          });
        }

        // Party's linked salesman (skip if the salesman recorded it himself).
        const salesmanId = p?.partyid?.salesmanid || null;
        if (salesmanId && String(salesmanId) !== String(createdbyData.createdby_id || "")) {
          await pushNotification({
            adminid: input.adminid,
            branchid: input.branchid,
            targettype: "staff",
            targetid: salesmanId,
            ntype: "payment",
            title: `Payment ₹${amount} ${verb} ${partyName}`,
            message: detail,
            appscreen: "Payments",
            docmodel: "Payment",
            docid: created._id,
          });
        }

        // The party (skip if the party recorded it themselves).
        const partyId = p?.partyid?._id;
        if (partyId && String(partyId) !== String(createdbyData.createdby_id || "")) {
          await pushNotification({
            adminid: input.adminid,
            branchid: input.branchid,
            targettype: "party",
            targetid: partyId,
            ntype: "payment",
            title: `Payment ₹${amount} ${isReceipt ? "received" : "made"}`,
            message: detail,
            appscreen: "Payments",
            docmodel: "Payment",
            docid: created._id,
          });
        }

        // Channel downline: the parent (upline) party also hears about its
        // child party's payments (partyid is populated, so assignaccountid is
        // available directly).
        const parentId = p?.partyid?.assignaccountid;
        if (parentId && String(parentId) !== String(createdbyData.createdby_id || "")) {
          await pushNotification({
            adminid: input.adminid,
            branchid: input.branchid,
            targettype: "party",
            targetid: parentId,
            ntype: "payment",
            title: `Payment ₹${amount} ${verb} ${partyName}`,
            message: detail,
            appscreen: "Payments",
            docmodel: "Payment",
            docid: created._id,
          });
        }
      } catch (e) { /* notifications are best-effort */ }

      return formatPayment(populated);
    },

    editPayment: async (_: any, { id, input }: any, context: any) => {
      const existing = await Payment.findById(id);
      if (!existing) throw new Error("Payment not found");

      const { user } = context;
      const updatedbyData = {
        createdby_name: input.createdby_name || existing.createdby_name || user?.name || user?.email,
      };

      const prepared = await prepareAllocation(input, id);
      await Payment.findByIdAndUpdate(id, { ...prepared, ...updatedbyData }, { new: true });

      // ✅ Update journal entry. Party-based when a party + ledger exist;
      // otherwise fall back to an expense-note settlement journal.
      let built: { entries: any[]; totaldebit: number; totalcredit: number } | null = null;
      if (input.partyid && input.ledgerid) {
        const partyAccount = await Account.findById(input.partyid).select("ledgerid name").lean();
        if (partyAccount?.ledgerid) {
          built = await buildPaymentEntries(input, partyAccount);
        }
      }
      if (!built && input.ledgerid) {
        built = await buildExpenseSettlementEntries(input);
      }
      // No party and no expense note — the other side is a plain ledger
      // (Capital, Loan, Rent, Salary, Interest, a bank charge).
      if (!built) {
        built = await buildLedgerEntries(input);
      }
      if (built) {
        if (existing.transactionid) {
          // Update existing transaction
          await Transaction.findByIdAndUpdate(existing.transactionid, {
            entries: built.entries,
            totaldebit: built.totaldebit,
            totalcredit: built.totalcredit,
            transactiondate: input.paymentdate || new Date(),
            narration: `Payment ${existing.paymentcode || ""}`,
          });
        } else {
          // Create new transaction if one didn't exist before
          const trx = await Transaction.create({
            adminid: input.adminid,
            branchid: input.branchid,
            entrytype: "manual",
            source: { docmodel: "Payment", docid: existing._id },
            transactiondate: input.paymentdate || new Date(),
            narration: `Payment ${existing.paymentcode || ""}`,
            entries: built.entries,
            totaldebit: built.totaldebit,
            totalcredit: built.totalcredit,
            createdby_id: existing.createdby_id,
            createdby_name: updatedbyData.createdby_name,
            createdby_type: existing.createdby_type,
          });
          await Payment.findByIdAndUpdate(id, { transactionid: trx._id });
        }
      }

      const updated = await Payment.findById(id).populate("ledgerid").populate("counterledgerid").populate("partyid").lean();
      if (!updated) throw new Error("Payment not found after update");
      return formatPayment(updated);
    },

    deletePayment: async (_: any, { id }: any) => {
      const payment = await Payment.findById(id);
      // Also deactivate the linked journal entry
      if (payment?.transactionid) {
        await Transaction.findByIdAndUpdate(payment.transactionid, { status: false });
      }
      const result = await Payment.findByIdAndUpdate(id, { status: false }, { new: true });
      return !!result;
    },

    // Re-spread an existing payment over different bills.
    //
    // Deliberately does NOT rebuild the journal: the party leg is the total
    // cash moved, which re-allocation never changes. Only the bill-level
    // attribution moves, exactly like Tally's net-zero bill-adjustment
    // journal. That also means this can never unbalance the books.
    reallocatePayment: async (_: any, { id, invoices }: any) => {
      const payment: any = await Payment.findById(id);
      if (!payment) throw new Error("Payment not found");
      if (!payment.status) throw new Error("Cannot re-allocate a deleted payment");

      const lines = Array.isArray(invoices) ? invoices : [];
      const settled = lines.reduce((t: number, l: any) => t + (Number(l.settledamount) || 0), 0);
      const discount = lines.reduce((t: number, l: any) => t + (Number(l.discount) || 0), 0);
      const commission = lines.reduce((t: number, l: any) => t + (Number(l.commission) || 0), 0);
      const cashApplied = parseFloat((settled - discount + commission).toFixed(2));

      if (cashApplied > Number(payment.amount) + 0.01) {
        throw new Error(
          `Allocation ₹${cashApplied.toFixed(2)} is more than the payment amount ₹${Number(
            payment.amount
          ).toFixed(2)}.`
        );
      }

      // Exclude this payment's own existing lines when checking capacity,
      // otherwise re-saving the same allocation would look like a double-settle.
      await assertAllocationsFit({ invoices: lines, adminid: payment.adminid, excludePaymentId: id });

      await Payment.findByIdAndUpdate(id, {
        invoices: lines.map((l: any) => ({
          ...l,
          allocatedmode: l.allocatedmode === "auto_fifo" ? "auto_fifo" : "manual",
          allocatedat: new Date(),
        })),
        unallocatedamount: parseFloat(Math.max(0, Number(payment.amount) - cashApplied).toFixed(2)),
        allocationmode: !lines.length
          ? "on_account"
          : lines.some((l: any) => l.allocatedmode === "auto_fifo")
          ? "auto_fifo"
          : "manual",
      });

      const updated = await Payment.findById(id).populate("ledgerid").populate("counterledgerid").populate("partyid").lean();
      if (!updated) throw new Error("Payment not found after re-allocation");
      return formatPayment(updated);
    },

    resetPayment: async (_: any, { id }: { id: string }) => {
      const payment = await Payment.findById(id);
      // Also restore the linked journal entry
      if (payment?.transactionid) {
        await Transaction.findByIdAndUpdate(payment.transactionid, { status: true });
      }
      const result = await Payment.findByIdAndUpdate(id, { status: true }, { new: true });
      return !!result;
    },
  },
};
