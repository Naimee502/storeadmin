import mongoose from "mongoose";
import { Transaction } from "../../../models/transactions";

export const transactionResolvers = {
  Query: {
    getTransactions: async (_: any, args: { filter?: any }) => {
      const filter = args.filter || {};
      const query: any = { status: true };

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

      const result = await Transaction.find(query).lean();

      return result.map((r: any) => ({ id: r._id.toString(), ...r }));
    },

    getDeletedTransactions: async (_: any, args: { filter?: any }) => {
      const filter = args.filter || {};
      const query: any = { status: false };

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

      const result = await Transaction.find(query).lean();

      return result.map((r: any) => ({ id: r._id.toString(), ...r }));
    },

    getTransactionById: async (_: any, args: { id: string; adminid?: string }) => {
      if (!args.id) return null;

      const query: any = { _id: new mongoose.Types.ObjectId(args.id) };
      if (args.adminid) query.adminid = new mongoose.Types.ObjectId(args.adminid);

      const transaction = await Transaction.findOne(query).lean();

      if (!transaction) return null;

      return {
        id: transaction._id.toString(),
        ...transaction,
        entries: transaction.entries || [],
      };
    },
  },

  Mutation: {
    addTransaction: async (_: any, { input }: any) => {
      // ensure balanced transaction before saving
      const totalDebit = input.entries.reduce((sum: number, e: any) => sum + (e.debit || 0), 0);
      const totalCredit = input.entries.reduce((sum: number, e: any) => sum + (e.credit || 0), 0);

      if (totalDebit !== totalCredit) {
        throw new Error("Transaction not balanced (Debit ≠ Credit)");
      }

      const created = await Transaction.create(input);
      return await Transaction.findById(created._id);
    },

    editTransaction: async (_: any, { id, input }: any) => {
      const existing = await Transaction.findById(id);
      if (!existing) throw new Error("Transaction not found");

      const totalDebit = input.entries.reduce((sum: number, e: any) => sum + (e.debit || 0), 0);
      const totalCredit = input.entries.reduce((sum: number, e: any) => sum + (e.credit || 0), 0);

      if (totalDebit !== totalCredit) {
        throw new Error("Transaction not balanced (Debit ≠ Credit)");
      }

      const updated = await Transaction.findByIdAndUpdate(id, input, { new: true });
      return updated;
    },

    deleteTransaction: async (_: any, { id }: any) => {
      const result = await Transaction.findByIdAndUpdate(
        id,
        { status: false },
        { new: true }
      );
      return !!result;
    },

    resetTransaction: async (_: any, { id }: { id: string }) => {
      const result = await Transaction.findByIdAndUpdate(
        id,
        { status: true },
        { new: true }
      );
      return !!result;
    },
  },
};
