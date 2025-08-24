import mongoose from "mongoose";
import { SalesInvoice } from "../../../models/salesinvoice";

export const salesInvoiceResolvers = {
  Query: {
    getSalesInvoices: async (_: any, args: { filter?: any }) => {
      const filter = args.filter || {};
      const query: any = { status: true };

      if (filter.branchid) query.branchid = filter.branchid;
      if (filter.adminid) query.adminid = filter.adminid;
      if (filter.salesmenid) query.salesmenid = filter.salesmenid;
      if (filter.paymenttype) query.paymenttype = filter.paymenttype;
      if (filter.partyacc)
        query.partyacc = { $regex: filter.partyacc, $options: "i" };
      if (filter.taxorsupplytype) query.taxorsupplytype = filter.taxorsupplytype;
      if (filter.billtype) query.billtype = filter.billtype;
      if (filter.invoicetype) query.invoicetype = filter.invoicetype;

      if (filter.billdateFrom || filter.billdateTo) {
        query.billdate = {};
        if (filter.billdateFrom) query.billdate.$gte = new Date(filter.billdateFrom);
        if (filter.billdateTo) query.billdate.$lte = new Date(filter.billdateTo);
      }

      const result = await SalesInvoice.find(query).lean();
      return result.map((r: any) => ({ id: r._id.toString(), ...r }));
    },

    getDeletedSalesInvoices: async (_: any, args: { filter?: any }) => {
      const filter = args.filter || {};
      const query: any = { status: false };

      if (filter.branchid) query.branchid = filter.branchid;
      if (filter.adminid) query.adminid = filter.adminid;
      if (filter.salesmenid) query.salesmenid = filter.salesmenid;

      if (filter.billdateFrom || filter.billdateTo) {
        query.billdate = {};
        if (filter.billdateFrom) query.billdate.$gte = new Date(filter.billdateFrom);
        if (filter.billdateTo) query.billdate.$lte = new Date(filter.billdateTo);
      }

      const result =  await SalesInvoice.find(query).lean();
      return result.map((r: any) => ({ id: r._id.toString(), ...r }));
    },

    getSalesInvoiceById: async (_: any, args: { id: string }) => {
      if (!args.id) return null;

      const invoice = await SalesInvoice.findById(args.id).lean().exec(); // .exec() helps TS inference
      if (!invoice) return null;

      return {
        id: (invoice as any)._id.toString(), // cast to any for TS
        ...(invoice as any),
      };
    }
  },

  Mutation: {
    addSalesInvoice: async (_: any, { input }: any) => {
      const safeInput = {
        ...input,
        productservice: input.productservice.map((p: any) => ({ ...p })),
      };
      const created = await SalesInvoice.create(safeInput);
      return await SalesInvoice.findById(created._id);
    },

    editSalesInvoice: async (_: any, { id, input }: any) => {
      const existing = await SalesInvoice.findById(id);
      if (!existing) throw new Error("Sales invoice not found");

      const safeInput = {
        ...input,
        productservice: input.productservice.map((p: any) => ({ ...p })),
      };

      const updated = await SalesInvoice.findByIdAndUpdate(id, safeInput, { new: true });
      if (updated) {
        await SalesInvoice.adjustStockAndTransactions(existing, updated);
      }

      return updated;
    },

    deleteSalesInvoice: async (_: any, { id }: any) => {
      const result = await SalesInvoice.findByIdAndUpdate(id, { status: false }, { new: true });
      return !!result;
    },

    resetSalesInvoice: async (_: any, { id }: { id: string }) => {
      const result = await SalesInvoice.findByIdAndUpdate(id, { status: true }, { new: true });
      return !!result;
    },
  },
};
