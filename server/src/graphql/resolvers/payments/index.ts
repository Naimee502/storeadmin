import mongoose from "mongoose";
import { Payment } from "../../../models/payments";
import { Account } from "../../../models/accounts";
import { AccountLedger } from "../../../models/accountledgers";
import { Transaction } from "../../../models/transactions";

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

// Build balanced journal entries for a payment/receipt
async function buildPaymentEntries(input: any, partyAccount: any) {
  const amount = parseFloat(String(input.amount));
  const partyLedgerId = partyAccount?.ledgerid;
  const cashBankLedgerId = input.ledgerid;

  if (!partyLedgerId || !cashBankLedgerId) return null;

  const partyName = partyAccount?.name || "Party";

  if (input.type === "receipt") {
    // Money coming in from customer: Dr Cash/Bank, Cr Customer
    return [
      { ledgerid: cashBankLedgerId, debit: amount, credit: 0, remarks: `Receipt from ${partyName}` },
      { ledgerid: partyLedgerId, debit: 0, credit: amount, remarks: `Settlement by ${partyName}` },
    ];
  } else {
    // Money going out to vendor: Dr Vendor, Cr Cash/Bank
    return [
      { ledgerid: partyLedgerId, debit: amount, credit: 0, remarks: `Payment to ${partyName}` },
      { ledgerid: cashBankLedgerId, debit: 0, credit: amount, remarks: `Payment to ${partyName}` },
    ];
  }
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

      // ✅ Create journal entry if party + ledger are provided
      if (input.partyid && input.ledgerid) {
        const partyAccount = await Account.findById(input.partyid).select("ledgerid name").lean();
        if (partyAccount?.ledgerid) {
          const entries = await buildPaymentEntries(input, partyAccount);
          if (entries) {
            const amount = parseFloat(String(input.amount));
            const trx = await Transaction.create({
              adminid: input.adminid,
              branchid: input.branchid,
              entrytype: "manual",
              source: { docmodel: "Payment", docid: created._id },
              transactiondate: input.paymentdate || new Date(),
              narration: `Payment ${created.paymentcode || ""}`,
              entries,
              totaldebit: amount,
              totalcredit: amount,
              ...createdbyData,
            });
            await Payment.findByIdAndUpdate(created._id, { transactionid: trx._id });
          }
        }
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

      // ✅ Update journal entry if party + ledger provided
      if (input.partyid && input.ledgerid) {
        const partyAccount = await Account.findById(input.partyid).select("ledgerid name").lean();
        if (partyAccount?.ledgerid) {
          const entries = await buildPaymentEntries(input, partyAccount);
          if (entries) {
            const amount = parseFloat(String(input.amount));
            if (existing.transactionid) {
              // Update existing transaction
              await Transaction.findByIdAndUpdate(existing.transactionid, {
                entries,
                totaldebit: amount,
                totalcredit: amount,
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
                entries,
                totaldebit: amount,
                totalcredit: amount,
                createdby_id: existing.createdby_id,
                createdby_name: updatedbyData.createdby_name,
                createdby_type: existing.createdby_type,
              });
              await Payment.findByIdAndUpdate(id, { transactionid: trx._id });
            }
          }
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
