import { SalesInvoice } from "../../../models/salesinvoice";

export const salesInvoiceResolvers = {
  Query: {
    getSalesInvoices: async (_: any, args: { branchid?: string }) => {
      const query: any = { status: true };
      if (args.branchid) {
        query.branchid = args.branchid;
      }
      return await SalesInvoice.find(query);
    },

    getDeletedSalesInvoices: async (_: any, args: { branchid?: string }) => {
      const query: any = { status: false };
      if (args.branchid) {
        query.branchid = args.branchid;
      }
      return await SalesInvoice.find(query);
    },

    getSalesInvoice: async (_: any, { id }: { id: string }) =>
      await SalesInvoice.findById(id),
  },

  Mutation: {
    addSalesInvoice: async (_: any, { input }: any) => {
      // Deep copy products to prevent shared reference mutation
      const safeInput = {
        ...input,
        products: input.products.map((p: any) => ({ ...p }))
      };

      return await SalesInvoice.create(safeInput);
    },

    addSalesInvoices: async (_: any, { inputs }: { inputs: any[] }) => {
      // Deep copy for all inputs
      const safeInputs = inputs.map((invoice) => ({
        ...invoice,
        products: invoice.products.map((p: any) => ({ ...p })),
      }));

      return await SalesInvoice.insertMany(safeInputs);
    },

    editSalesInvoice: async (_: any, { id, input }: any) => {
      const existing = await SalesInvoice.findById(id);
      if (!existing) throw new Error("Sales invoice not found");

      // Deep clone products to avoid shared references
      const safeInput = {
        ...input,
        products: input.products.map((p: any) => ({ ...p }))
      };

      const updated = await SalesInvoice.findByIdAndUpdate(id, safeInput, { new: true });

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
