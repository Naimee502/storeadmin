import mongoose from "mongoose";
import { Payment } from "../../../models/payments";

export const paymentResolvers = {
  Query: {
    getPayments: async (_: any, args: { filter?: any }) => {
      const filter = args.filter || {};
      const query: any = { status: true };

      if (filter.adminid) query.adminid = new mongoose.Types.ObjectId(filter.adminid);
      if (filter.branchid) query.branchid = new mongoose.Types.ObjectId(filter.branchid);
      if (filter.type) query.type = filter.type;
      if (filter.partyid) query.partyid = new mongoose.Types.ObjectId(filter.partyid);
      if (filter.paymentcode)
        query.paymentcode = { $regex: filter.paymentcode, $options: "i" };
      if (typeof filter.status === "boolean") query.status = filter.status;

      // Date filter
      if (filter.dateFrom || filter.dateTo) {
        query.paymentdate = {};
        if (filter.dateFrom) query.paymentdate.$gte = new Date(filter.dateFrom);
        if (filter.dateTo) query.paymentdate.$lte = new Date(filter.dateTo);
      }

      const result = await Payment.find(query).lean();
      return result.map((r: any) => ({ id: r._id.toString(), ...r }));
    },

    getDeletedPayments: async (_: any, args: { filter?: any }) => {
      const filter = args.filter || {};
      const query: any = { status: false };

      if (filter.adminid) query.adminid = new mongoose.Types.ObjectId(filter.adminid);
      if (filter.branchid) query.branchid = new mongoose.Types.ObjectId(filter.branchid);
      if (filter.type) query.type = filter.type;
      if (filter.partyid) query.partyid = new mongoose.Types.ObjectId(filter.partyid);
      if (filter.paymentcode)
        query.paymentcode = { $regex: filter.paymentcode, $options: "i" };

      if (filter.dateFrom || filter.dateTo) {
        query.paymentdate = {};
        if (filter.dateFrom) query.paymentdate.$gte = new Date(filter.dateFrom);
        if (filter.dateTo) query.paymentdate.$lte = new Date(filter.dateTo);
      }

      const result = await Payment.find(query).lean();
      return result.map((r: any) => ({ id: r._id.toString(), ...r }));
    },

    getPaymentById: async (_: any, args: { id: string; adminid?: string }) => {
      if (!args.id) return null;
      const query: any = { _id: new mongoose.Types.ObjectId(args.id) };
      if (args.adminid) query.adminid = new mongoose.Types.ObjectId(args.adminid);

      const payment = await Payment.findOne(query).lean();
      if (!payment) return null;

      return { id: payment._id.toString(), ...payment, invoices: payment.invoices || [] };
    },
  },

  Mutation: {
    addPayment: async (_: any, { input }: any) => {
      const created = await Payment.create(input);
      return await Payment.findById(created._id);
    },

    editPayment: async (_: any, { id, input }: any) => {
      const existing = await Payment.findById(id);
      if (!existing) throw new Error("Payment not found");

      const updated = await Payment.findByIdAndUpdate(id, input, { new: true });
      return updated;
    },

    deletePayment: async (_: any, { id }: any) => {
      const result = await Payment.findByIdAndUpdate(id, { status: false }, { new: true });
      return !!result;
    },

    resetPayment: async (_: any, { id }: { id: string }) => {
      const result = await Payment.findByIdAndUpdate(id, { status: true }, { new: true });
      return !!result;
    },
  },
};
