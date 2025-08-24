import mongoose from "mongoose";
import { TransferStock } from "../../../models/transferstock";

export const transferStockResolvers = {
  Query: {
    getTransferStocks: async (_: any, { adminId, frombranchid }: { adminId?: string; frombranchid?: string }) => {
      const filter: any = { status: true };

      if (adminId) filter.admin = new mongoose.Types.ObjectId(adminId);
      if (frombranchid) filter.frombranchid = new mongoose.Types.ObjectId(frombranchid);

      // Return IDs only to match GraphQL schema
      return await TransferStock.find(filter)
        .populate("admin"); // only populate admin if schema expects object
    },

    getDeletedTransferStocks: async (_: any, { adminId, frombranchid }: { adminId?: string; frombranchid?: string }) => {
      const filter: any = { status: false };

      if (adminId) filter.admin = new mongoose.Types.ObjectId(adminId);
      if (frombranchid) filter.frombranchid = new mongoose.Types.ObjectId(frombranchid);

      return await TransferStock.find(filter)
        .populate("admin");
    },

    getTransferStockById: async (_: any, { id, adminId }: { id: string; adminId?: string }) => {
      const filter: any = { _id: id };
      if (adminId) filter.admin = new mongoose.Types.ObjectId(adminId);

      return await TransferStock.findOne(filter)
        .populate("admin");
    },
  },

  Mutation: {
    addTransferStock: async (_: any, { input }: any) => {
      const newDoc = await TransferStock.create(input);
      await TransferStock.adjustStock(null, newDoc);
      // return IDs only
      return await TransferStock.findById(newDoc._id)
        .populate("admin");
    },

    editTransferStock: async (_: any, { id, input }: any) => {
      const oldDoc = await TransferStock.findById(id);
      const newDoc = await TransferStock.findByIdAndUpdate(id, input, { new: true });
      if (oldDoc && newDoc) await TransferStock.adjustStock(oldDoc, newDoc);

      return await TransferStock.findById(newDoc?._id)
        .populate("admin");
    },

    deleteTransferStock: async (_: any, { id }: { id: string }) => {
      const oldDoc = await TransferStock.findById(id);
      if (oldDoc) {
        await TransferStock.adjustStock(oldDoc, null); // revert stock
      }
      const result = await TransferStock.findByIdAndUpdate(id, { status: false }, { new: true });
      return !!result;
    },

    resetTransferStock: async (_: any, { id }: { id: string }) => {
      const result = await TransferStock.findByIdAndUpdate(id, { status: true }, { new: true });
      if (result) {
        await TransferStock.adjustStock(null, result); // reapply stock
      }
      return !!result;
    },
  },
};
