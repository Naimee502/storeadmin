import { TransferStock } from "../../../models/transferstock";

export const transferStockResolvers = {
  Query: {
    getTransferStocks: async (_: any, { frombranchid }: { frombranchid?: string }) => {
      const filter: any = { status: true };
      if (frombranchid) filter.frombranchid = frombranchid;
      return await TransferStock.find(filter);
    },
    getDeletedTransferStocks: async (_: any, { frombranchid }: { frombranchid?: string }) => {
      const filter: any = { status: false };
      if (frombranchid) filter.frombranchid = frombranchid;
      return await TransferStock.find(filter);
    },
    getTransferStockById: async (_: any, { id }: { id: string }) => {
      return await TransferStock.findById(id);
    },
  },

  Mutation: {
    addTransferStock: async (_: any, { input }: any) => {
      const newDoc = await TransferStock.create(input);
      await TransferStock.adjustStock(null, newDoc); 
      return newDoc;
    },

    editTransferStock: async (_: any, { id, input }: any) => {
      const oldDoc = await TransferStock.findById(id);
      const newDoc = await TransferStock.findByIdAndUpdate(id, input, { new: true });
      if (oldDoc && newDoc) {
        await TransferStock.adjustStock(oldDoc, newDoc);
      }
      return newDoc;
    },

    deleteTransferStock: async (_: any, { id }: any) => {
      const result = await TransferStock.findByIdAndUpdate(id, { status: false }, { new: true });
      return !!result;
    },

    resetTransferStock: async (_: any, { id }: { id: string }) => {
      const result = await TransferStock.findByIdAndUpdate(id, { status: true }, { new: true });
      return !!result;
    },
  },
};
