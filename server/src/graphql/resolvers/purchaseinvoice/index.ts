import { PurchaseInvoice } from "../../../models/purchaseinvoice";

export const purchaseInvoiceResolvers = {
  Query: {
    getPurchaseInvoices: async () => {
      const invoices = await PurchaseInvoice.find({ status: true });
      return invoices;
    },
    getDeletedPurchaseInvoices: async () => {
      return await PurchaseInvoice.find({ status: false });
    },
    getPurchaseInvoice: async (_: any, { id }: { id: string }) =>
      await PurchaseInvoice.findById(id),
    },
  Mutation: {
    addPurchaseInvoice: async (_: any, { input }: any) => {
      try {
        const invoice = await PurchaseInvoice.create(input);
        return invoice;
      } catch (error) {
        console.error('Error adding purchase invoice:', error);
        throw new Error('Failed to add purchase invoice');
      }
    },

    addPurchaseInvoices: async (_: any, { inputs }: { inputs: any[] }) => {
      const createdInvoices = await PurchaseInvoice.insertMany(inputs);
      return createdInvoices;
    },

    editPurchaseInvoice: async (_: any, { id, input }: any) =>
      await PurchaseInvoice.findByIdAndUpdate(id, input, { new: true }),

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
