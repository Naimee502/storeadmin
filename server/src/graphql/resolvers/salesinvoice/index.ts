import { SalesInvoice } from "../../../models/salesinvoice";

export const salesInvoiceResolvers = {
  Query: {
    getSalesInvoices: async (_: any, args: { adminId?: string; branchid?: string }) => {
      const query: any = { status: true };
      if (args.branchid) query.branchid = args.branchid;
      if (args.adminId) query.admin = args.adminId;

      return await SalesInvoice.find(query).populate("admin");
    },

    getDeletedSalesInvoices: async (_: any, args: { adminId?: string; branchid?: string }) => {
      const query: any = { status: false };
      if (args.branchid) query.branchid = args.branchid;
      if (args.adminId) query.admin = args.adminId;

      return await SalesInvoice.find(query).populate("admin");
    },

    getSalesInvoice: async (_: any, args: { id: string; adminId?: string }) => {
      const query: any = { _id: args.id };
      if (args.adminId) query.admin = args.adminId;

      return await SalesInvoice.findOne(query).populate("admin");
    },
  },

  Mutation: {
    addSalesInvoice: async (_: any, { input }: any) => {
      const safeInput = {
        ...input,
        products: input.products.map((p: any) => ({ ...p })),
      };

      const created = await SalesInvoice.create(safeInput);
      return await SalesInvoice.findById(created._id).populate("admin");
    },

    addSalesInvoices: async (_: any, { inputs }: { inputs: any[] }) => {
      const safeInputs = inputs.map((invoice) => ({
        ...invoice,
        products: invoice.products.map((p: any) => ({ ...p })),
      }));

      const inserted = await SalesInvoice.insertMany(safeInputs);
      const ids = inserted.map((i) => i._id);
      return await SalesInvoice.find({ _id: { $in: ids } }).populate("admin");
    },

    editSalesInvoice: async (_: any, { id, input }: any) => {
      const existing = await SalesInvoice.findById(id);
      if (!existing) throw new Error("Sales invoice not found");

      const safeInput = {
        ...input,
        products: input.products.map((p: any) => ({ ...p })),
      };

      const updated = await SalesInvoice.findByIdAndUpdate(id, safeInput, {
        new: true,
      }).populate("admin");

      if (updated) {
        await SalesInvoice.adjustStock(existing, updated);
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
