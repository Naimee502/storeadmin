import { PurchaseInvoice } from "../../../models/purchaseinvoice";

export const purchaseInvoiceResolvers = {
  Query: {
    getPurchaseInvoices: async (_: any, args: { branchid?: string }) => {
      const query: any = { status: true };
      if (args.branchid) query.branchid = args.branchid;
      return await PurchaseInvoice.find(query);
    },

    getDeletedPurchaseInvoices: async (_: any, args: { branchid?: string }) => {
      const query: any = { status: false };
      if (args.branchid) query.branchid = args.branchid;
      return await PurchaseInvoice.find(query);
    },

    getPurchaseInvoice: async (_: any, { id }: { id: string }) =>
      await PurchaseInvoice.findById(id),
  },

  Mutation: {
    addPurchaseInvoice: async (_: any, { input }: any) => {
      try {
        const safeInput = {
          ...input,
          products: input.products.map((p: any) => ({ ...p })),
        };
        return await PurchaseInvoice.create(safeInput);
      } catch (error) {
        console.error("Error adding purchase invoice:", error);
        throw new Error("Failed to add purchase invoice");
      }
    },

    addPurchaseInvoices: async (_: any, { inputs }: { inputs: any[] }) => {
      const safeInputs = inputs.map((invoice) => ({
        ...invoice,
        products: invoice.products.map((p: any) => ({ ...p })),
      }));
      return await PurchaseInvoice.insertMany(safeInputs);
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
      });

      if (updated) {
        await PurchaseInvoice.adjustStock(existing, updated);
      }

      return updated;
    },

    deletePurchaseInvoice: async (_: any, { id }: any) => {
      const result = await PurchaseInvoice.findByIdAndUpdate(
        id,
        { status: false },
        { new: true }
      );
      return !!result;
    },

    resetPurchaseInvoice: async (_: any, { id }: { id: string }) => {
      const result = await PurchaseInvoice.findByIdAndUpdate(
        id,
        { status: true },
        { new: true }
      );
      return !!result;
    },
  },
};
