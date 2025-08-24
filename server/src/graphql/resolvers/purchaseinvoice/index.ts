import mongoose from "mongoose";
import { PurchaseInvoice } from "../../../models/purchaseinvoice";

export const purchaseInvoiceResolvers = {
  Query: {
    getPurchaseInvoices: async (_: any, args: { filter?: any }) => {
      const filter = args.filter || {};
      const query: any = { status: true };

      if (filter.branchid) query.branchid = filter.branchid;
      if (filter.adminid) query.adminid = filter.adminid;
      if (filter.supplierid) query.supplierid = filter.supplierid;
      if (filter.paymenttype) query.paymenttype = filter.paymenttype;
      if (filter.partyacc) query.partyacc = { $regex: filter.partyacc, $options: "i" };
      if (filter.billtype) query.billtype = filter.billtype;
      if (filter.invoicetype) query.invoicetype = filter.invoicetype;
      if (typeof filter.status === "boolean") query.status = filter.status;

      if (filter.billdateFrom || filter.billdateTo) {
        query.billdate = {};
        if (filter.billdateFrom) query.billdate.$gte = new Date(filter.billdateFrom);
        if (filter.billdateTo) query.billdate.$lte = new Date(filter.billdateTo);
      }

      const result = await PurchaseInvoice.find(query).lean();
      return result.map((r: any) => ({ id: r._id.toString(), ...r }));
    },

    getDeletedPurchaseInvoices: async (_: any, { adminId, branchId }: any) => {
      const query: any = { status: false };

      if (adminId) query.adminid = adminId;
      if (branchId) query.branchid = branchId;

      const invoices = await PurchaseInvoice.find(query).lean().exec();

      return invoices.map((inv: any) => ({
        id: inv._id.toString(),
        ...inv,
      }));
    }
  },

  Mutation: {
    addPurchaseInvoice: async (_: any, { input }: any) => {
      const created = await PurchaseInvoice.create(input);
      return await PurchaseInvoice.findById(created._id);
    },

    editPurchaseInvoice: async (_: any, { id, input }: any) => {
      const existing = await PurchaseInvoice.findById(id);
      if (!existing) throw new Error("Purchase invoice not found");

      const updated = await PurchaseInvoice.findByIdAndUpdate(id, input, { new: true });
      if (updated) {
        await PurchaseInvoice.adjustStockAndTransactions(existing, updated);
      }

      return updated;
    },

    deletePurchaseInvoice: async (_: any, { id }: any) => {
      const result = await PurchaseInvoice.findByIdAndUpdate(id, { status: false }, { new: true });
      return !!result;
    },

    resetPurchaseInvoice: async (_: any, { id }: any) => {
      const result = await PurchaseInvoice.findByIdAndUpdate(id, { status: true }, { new: true });
      return !!result;
    },
  },
};
