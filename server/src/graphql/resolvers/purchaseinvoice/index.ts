import { PurchaseInvoice } from "../../../models/purchaseinvoice";

export const purchaseInvoiceResolvers = {
  Query: {
    getPurchaseInvoices: async (_: any, args: { adminId?: string; branchid?: string }) => {
      const query: any = { status: true };
      if (args.adminId) query.admin = args.adminId;
      if (args.branchid) query.branchid = args.branchid;
      return await PurchaseInvoice.find(query).populate('admin');
    },

    getDeletedPurchaseInvoices: async (_: any, args: { adminId?: string; branchid?: string }) => {
      const query: any = { status: false };
      if (args.adminId) query.admin = args.adminId;
      if (args.branchid) query.branchid = args.branchid;
      return await PurchaseInvoice.find(query).populate('admin');
    },

    getPurchaseInvoice: async (_: any, args: { id: string; adminId?: string }) => {
      const query: any = { _id: args.id };
      if (args.adminId) query.admin = args.adminId;
      return await PurchaseInvoice.findOne(query).populate('admin');
    },
  },

  Mutation: {
    addPurchaseInvoice: async (_: any, { input }: any) => {
      const safeInput = {
        ...input,
        products: input.products.map((p: any) => ({ ...p })),
      };

      const created = await PurchaseInvoice.create(safeInput);
      return await PurchaseInvoice.findById(created._id).populate("admin");
    },

    addPurchaseInvoices: async (_: any, { inputs }: { inputs: any[] }) => {
      const safeInputs = inputs.map((invoice) => ({
        ...invoice,
        products: invoice.products.map((p: any) => ({ ...p })),
      }));

      const inserted = await PurchaseInvoice.insertMany(safeInputs);
      const ids = inserted.map((i) => i._id);
      return await PurchaseInvoice.find({ _id: { $in: ids } }).populate("admin");
    },

    editPurchaseInvoice: async (_: any, { id, input }: any) => {
      const existing = await PurchaseInvoice.findById(id);
      if (!existing) throw new Error("Purchase invoice not found");

      const safeInput = {
        ...input,
        products: input.products.map((p: any) => ({ ...p })),
      };

      const updated = await PurchaseInvoice.findByIdAndUpdate(id, safeInput, {
        new: true,
      }).populate("admin");

      if (updated) {
        await PurchaseInvoice.adjustStock(existing, updated);
      }

      return updated;
    },

    deletePurchaseInvoice: async (_: any, { id }: any) => {
      const result = await PurchaseInvoice.findByIdAndUpdate(id, { status: false }, { new: true });
      return !!result;
    },

    resetPurchaseInvoice: async (_: any, { id }: { id: string }) => {
      const result = await PurchaseInvoice.findByIdAndUpdate(id, { status: true }, { new: true });
      return !!result;
    },
  },
};
