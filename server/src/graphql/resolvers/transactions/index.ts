import mongoose from "mongoose";
import { Transaction } from "../../../models/transactions";
import { AccountLedger } from "../../../models/accountledgers";

export const transactionResolvers = {
  Query: {
    getTransactions: async (_: any, args: { filter?: any }, context: any) => {
      const filter = args.filter || {};
      const query: any = { status: true };
      const { user } = context;

      // ✅ Role-based filtering
      if (user?.type === 'branch') {
        query.$or = [
          { createdby_type: 'branch', createdby_id: user?.id },
          { branchid: user?.branch_id || user?.id }
        ];
      } else if (user?.type === 'staff') {
        query.createdby_id = user?.id;
      }

      if (filter.adminid) query.adminid = new mongoose.Types.ObjectId(filter.adminid);
      if (filter.branchid) query.branchid = new mongoose.Types.ObjectId(filter.branchid);
      if (filter.entrytype) query.entrytype = filter.entrytype;
      if (filter.transactioncode)
        query.transactioncode = { $regex: filter.transactioncode, $options: "i" };
      if (typeof filter.status === "boolean") query.status = filter.status;

      // Date filter
      if (filter.dateFrom || filter.dateTo) {
        query.transactiondate = {};
        if (filter.dateFrom) query.transactiondate.$gte = new Date(filter.dateFrom);
        if (filter.dateTo) query.transactiondate.$lte = new Date(filter.dateTo);
      }

      const transactions = await Transaction.find(query)
        .populate("entries.ledgerid")
        .lean();

      return transactions.map((r: any) => ({
        id: r._id.toString(),
        ...r,
        entries: r.entries.map((e: any) => ({
          ledgerid: e.ledgerid
            ? { id: e.ledgerid._id.toString(), ledgername: e.ledgerid.ledgername }
            : null,
          debit: e.debit,
          credit: e.credit,
          productserviceid: e.productserviceid,
          variantid: e.variantid,
          remarks: e.remarks,
        })),
      }));
    },

    getDeletedTransactions: async (_: any, args: { filter?: any }, context: any) => {
      const filter = args.filter || {};
      const query: any = { status: false };
      const { user } = context;

      // ✅ Role-based filtering
      if (user?.type === 'branch') {
        query.$or = [
          { createdby_type: 'branch', createdby_id: user?.id },
          { branchid: user?.branch_id || user?.id }
        ];
      } else if (user?.type === 'staff') {
        query.createdby_id = user?.id;
      }

      if (filter.adminid) query.adminid = new mongoose.Types.ObjectId(filter.adminid);
      if (filter.branchid) query.branchid = new mongoose.Types.ObjectId(filter.branchid);
      if (filter.entrytype) query.entrytype = filter.entrytype;
      if (filter.transactioncode)
        query.transactioncode = { $regex: filter.transactioncode, $options: "i" };

      if (filter.dateFrom || filter.dateTo) {
        query.transactiondate = {};
        if (filter.dateFrom) query.transactiondate.$gte = new Date(filter.dateFrom);
        if (filter.dateTo) query.transactiondate.$lte = new Date(filter.dateTo);
      }

      const transactions = await Transaction.find(query)
        .populate("entries.ledgerid")
        .lean();

      return transactions.map((r: any) => ({
        id: r._id.toString(),
        ...r,
        entries: r.entries.map((e: any) => ({
          ledgerid: e.ledgerid
            ? { id: e.ledgerid._id.toString(), ledgername: e.ledgerid.ledgername }
            : null,
          debit: e.debit,
          credit: e.credit,
          productserviceid: e.productserviceid,
          variantid: e.variantid,
          remarks: e.remarks,
        })),
      }));
    },

    getTransactionById: async (_: any, args: { id: string; adminid?: string }) => {
      if (!args.id) return null;

      const query: any = { _id: new mongoose.Types.ObjectId(args.id) };
      if (args.adminid) query.adminid = new mongoose.Types.ObjectId(args.adminid);

      const transaction = await Transaction.findOne(query)
        .populate("entries.ledgerid")
        .lean();

      if (!transaction) return null;

      return {
        id: transaction._id.toString(),
        ...transaction,
        entries: transaction.entries.map((e: any) => ({
          ledgerid: e.ledgerid
            ? { id: e.ledgerid._id.toString(), ledgername: e.ledgerid.ledgername }
            : null,
          debit: e.debit,
          credit: e.credit,
          productserviceid: e.productserviceid,
          variantid: e.variantid,
          remarks: e.remarks,
        })),
      };
    },
  },

  Mutation: {
    addTransaction: async (_: any, { input }: any, context: any) => {
      const totalDebit = input.entries.reduce((sum: number, e: any) => sum + (e.debit || 0), 0);
      const totalCredit = input.entries.reduce((sum: number, e: any) => sum + (e.credit || 0), 0);

      if (totalDebit !== totalCredit) {
        throw new Error("Transaction not balanced (Debit ≠ Credit)");
      }

      // ✅ Extract user info from context and populate createdby fields
      const { user } = context;
      const createdbyData = {
        createdby_id: user?.id,
        createdby_name: user?.name || user?.email,
        createdby_type: user?.type || 'admin',
      };

      const created = await Transaction.create({ ...input, ...createdbyData });

      const populated = await Transaction.findById(created._id).populate("entries.ledgerid", "ledgername").lean();

      return {
        ...populated,
        id: populated?._id.toString(),
        entries: populated?.entries.map((e: any) => ({
          ledgerid: e.ledgerid
            ? { id: e.ledgerid._id.toString(), ledgername: e.ledgerid.ledgername }
            : null,
          debit: e.debit,
          credit: e.credit,
          productserviceid: e.productserviceid,
          variantid: e.variantid,
          remarks: e.remarks,
        })),
      };
    },

    editTransaction: async (_: any, { id, input }: any, context: any) => {
      const totalDebit = input.entries.reduce((sum: number, e: any) => sum + (e.debit || 0), 0);
      const totalCredit = input.entries.reduce((sum: number, e: any) => sum + (e.credit || 0), 0);

      if (totalDebit !== totalCredit) {
        throw new Error("Transaction not balanced (Debit ≠ Credit)");
      }

      const updated = await Transaction.findByIdAndUpdate(id, input, { new: true })
        .populate("entries.ledgerid", "ledgername")
        .lean();

      return {
        ...updated,
        id: updated?._id.toString(),
        entries: updated?.entries.map((e: any) => ({
          ledgerid: e.ledgerid
            ? { id: e.ledgerid._id.toString(), ledgername: e.ledgerid.ledgername }
            : null,
          debit: e.debit,
          credit: e.credit,
          productserviceid: e.productserviceid,
          variantid: e.variantid,
          remarks: e.remarks,
        })),
      };
    },

    deleteTransaction: async (_: any, { id }: any) => {
      const result = await Transaction.findByIdAndUpdate(id, { status: false }, { new: true });
      return !!result;
    },

    resetTransaction: async (_: any, { id }: { id: string }) => {
      const result = await Transaction.findByIdAndUpdate(id, { status: true }, { new: true });
      return !!result;
    },
  },
};
