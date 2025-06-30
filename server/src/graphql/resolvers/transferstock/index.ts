import mongoose from "mongoose";
import { TransferStock } from "../../../models/transferstock";

export const transferStockResolvers = {
  Query: {
    getTransferStocks: async (
      _: any,
      { adminId, frombranchid }: { adminId?: string; frombranchid?: string }
    ) => {
      const filter: any = { status: true };

      if (adminId) {
        try {
          filter.admin = new mongoose.Types.ObjectId(adminId);
        } catch (err) {
          console.error("Invalid adminId:", adminId);
          return [];
        }
      }

      if (frombranchid) {
        try {
          filter.frombranchid = new mongoose.Types.ObjectId(frombranchid);
        } catch (err) {
          console.error("Invalid frombranchid:", frombranchid);
          return [];
        }
      }

      return await TransferStock.find(filter).populate("admin");
    },

    getDeletedTransferStocks: async (
      _: any,
      { adminId, frombranchid }: { adminId?: string; frombranchid?: string }
    ) => {
      const filter: any = { status: false };

      if (adminId) {
        try {
          filter.admin = new mongoose.Types.ObjectId(adminId);
        } catch (err) {
          console.error("Invalid adminId:", adminId);
          return [];
        }
      }

      if (frombranchid) {
        try {
          filter.frombranchid = new mongoose.Types.ObjectId(frombranchid);
        } catch (err) {
          console.error("Invalid frombranchid:", frombranchid);
          return [];
        }
      }

      return await TransferStock.find(filter).populate("admin");
    },

    getTransferStockById: async (_: any, { id, adminId }: { id: string; adminId?: string }) => {
      const filter: any = { _id: id };

      if (adminId) {
        try {
          filter.admin = new mongoose.Types.ObjectId(adminId);
        } catch (err) {
          console.error("Invalid adminId:", adminId);
          return null;
        }
      }

      return await TransferStock.findOne(filter).populate("admin");
    },
  },

  Mutation: {
    addTransferStock: async (_: any, { input }: any) => {
      const newDoc = await TransferStock.create(input);
      await TransferStock.adjustStock(null, newDoc);
      return await TransferStock.findById(newDoc._id).populate("admin");
    },

    editTransferStock: async (_: any, { id, input }: any) => {
      const oldDoc = await TransferStock.findById(id);
      const newDoc = await TransferStock.findByIdAndUpdate(id, input, { new: true });
      if (oldDoc && newDoc) {
        await TransferStock.adjustStock(oldDoc, newDoc);
      }
      return await TransferStock.findById(newDoc?._id).populate("admin");
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
