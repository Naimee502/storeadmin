import { TransferStock } from "../../../models/transferstock";

export const transferStockResolvers = {
  Query: {
    getTransferStocks: async () => {
      const transfers = await TransferStock.find({ status: true });
      return transfers;
    },
    getDeletedTransferStocks: async () => {
      const deletedTransfers = await TransferStock.find({ status: false });
      return deletedTransfers;
    },
    getTransferStockById: async (_: any, { id }: { id: string }) => {
      return await TransferStock.findById(id);
    },
  },
  Mutation: {
    addTransferStock: async (_: any, { input }: any) => {
      return await TransferStock.create(input);
    },
    editTransferStock: async (_: any, { id, input }: any) => {
      return await TransferStock.findByIdAndUpdate(id, input, { new: true });
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
