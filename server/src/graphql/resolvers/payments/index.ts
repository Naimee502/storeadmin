import mongoose from "mongoose";
import { Payment } from "../../../models/payments";
import { Account } from "../../../models/accounts";
import { AccountLedger } from "../../../models/accountledgers";
import { Transaction } from "../../../models/transactions";
import { AccountGroup } from "../../../models/accountgroups";
import { ExpenseNote } from "../../../models/expensenote";

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

  // Party leg = receivable/payable cleared. When bills are selected that's the
  // sum of settledamount; otherwise it's the manual amount (plain payment).
  const settledTotal = invs.length
    ? parseFloat(invs.reduce((s: number, i: any) => s + (Number(i.settledamount) || 0), 0).toFixed(2))
    : parseFloat(String(input.amount)) || 0;

  // Cash actually moved = cleared total LESS discount (concession given) PLUS
  // commission (extra charged on top of the bill).
  const cashLeg = parseFloat((settledTotal - totalDiscount + totalCommission).toFixed(2));

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

function formatPayment(r: any) {
  return {
    ...r,
    id: r._id.toString(),
    ledgerid: r.ledgerid ? { ...r.ledgerid, id: r.ledgerid._id?.toString() } : null,
    partyid: r.partyid ? { ...r.partyid, id: r.partyid._id?.toString() } : null,
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
      if (filter.paymentcode) query.paymentcode = { $regex: filter.paymentcode, $options: "i" };
      if (typeof filter.status === "boolean") query.status = filter.status;
      if (filter.dateFrom || filter.dateTo) {
        query.paymentdate = {};
        if (filter.dateFrom) query.paymentdate.$gte = new Date(filter.dateFrom);
        if (filter.dateTo) query.paymentdate.$lte = new Date(filter.dateTo);
      }

      const result = await Payment.find(query).populate("ledgerid").populate("partyid").lean();
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
      if (filter.paymentcode) query.paymentcode = { $regex: filter.paymentcode, $options: "i" };
      if (filter.dateFrom || filter.dateTo) {
        query.paymentdate = {};
        if (filter.dateFrom) query.paymentdate.$gte = new Date(filter.dateFrom);
        if (filter.dateTo) query.paymentdate.$lte = new Date(filter.dateTo);
      }

      const result = await Payment.find(query).populate("partyid").populate("ledgerid").lean();
      return result.map(formatPayment);
    },

    getPaymentById: async (_: any, args: { id: string; adminid?: string }) => {
      if (!args.id) return null;
      const query: any = { _id: new mongoose.Types.ObjectId(args.id) };
      if (args.adminid) query.adminid = new mongoose.Types.ObjectId(args.adminid);
      const payment = await Payment.findOne(query).populate("partyid").populate("ledgerid").lean();
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

      const created = await Payment.create({ ...input, ...createdbyData });

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

      const populated = await Payment.findById(created._id).populate("ledgerid").populate("partyid").lean();
      if (!populated) throw new Error("Payment not found after creation");
      return formatPayment(populated);
    },

    editPayment: async (_: any, { id, input }: any, context: any) => {
      const existing = await Payment.findById(id);
      if (!existing) throw new Error("Payment not found");

      const { user } = context;
      const updatedbyData = {
        createdby_name: input.createdby_name || existing.createdby_name || user?.name || user?.email,
      };

      await Payment.findByIdAndUpdate(id, { ...input, ...updatedbyData }, { new: true });

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

      const updated = await Payment.findById(id).populate("ledgerid").populate("partyid").lean();
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
