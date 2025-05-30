import { SalesInvoice } from "../../../models/salesinvoice";

export const salesInvoiceResolvers = {
  Query: {
    getSalesInvoices: async () => {
      const invoices = await SalesInvoice.find({ status: true });
      return invoices;
    },
    getSalesInvoice: async (_: any, { id }: { id: string }) =>
      await SalesInvoice.findById(id),
  },
  Mutation: {
    addSalesInvoice: async (_: any, { input }: any) => {
      try {
        const invoice = await SalesInvoice.create(input);
        return invoice;
      } catch (error) {
        console.error('Error adding sales invoice:', error);
        throw new Error('Failed to add sales invoice');
      }
    },

    addSalesInvoices: async (_: any, { inputs }: { inputs: any[] }) => {
      const createdInvoices = await SalesInvoice.insertMany(inputs);
      return createdInvoices;
    },

    editSalesInvoice: async (_: any, { id, input }: any) =>
      await SalesInvoice.findByIdAndUpdate(id, input, { new: true }),

    deleteSalesInvoice: async (_: any, { id }: any) => {
      const result = await SalesInvoice.findByIdAndUpdate(id, { status: false }, { new: true });
      return !!result;
    },
  },
};
