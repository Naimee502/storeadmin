import mongoose from "mongoose";
import { TransferStock } from "../../../models/transferstock";

export const transferStockResolvers = {
  Query: {
    getTransferStocks: async (_: any, { adminId, frombranchid }: { adminId?: string; frombranchid?: string }, context: any) => {
      const filter: any = { status: true };
      const { user } = context;

      // ✅ Role-based filtering
      if (user?.type === 'branch') {
        filter.$or = [
          { createdby_type: 'branch', createdby_id: user?.id },
          { frombranchid: user?.branch_id || user?.id }
        ];
      } else if (user?.type === 'staff') {
        filter.createdby_id = user?.id;
      }

      if (adminId) filter.admin = new mongoose.Types.ObjectId(adminId);
      if (frombranchid) filter.frombranchid = new mongoose.Types.ObjectId(frombranchid);

      // Return IDs only to match GraphQL schema
      return await TransferStock.find(filter)
        .populate("admin"); // only populate admin if schema expects object
    },

    getDeletedTransferStocks: async (_: any, { adminId, frombranchid }: { adminId?: string; frombranchid?: string }, context: any) => {
      const filter: any = { status: false };
      const { user } = context;

      // ✅ Role-based filtering
      if (user?.type === 'branch') {
        filter.$or = [
          { createdby_type: 'branch', createdby_id: user?.id },
          { frombranchid: user?.branch_id || user?.id }
        ];
      } else if (user?.type === 'staff') {
        filter.createdby_id = user?.id;
      }

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
    addTransferStock: async (_: any, { input }: any, context: any) => {
      const { user } = context;
      const createdbyData = {
        createdby_id: user?.id,
        createdby_name: input.createdby_name || user?.name || user?.email,
        createdby_type: user?.type || input.createdby_type || 'admin',
      };

      const newDoc = await TransferStock.create({ ...input, ...createdbyData });
      await TransferStock.adjustStock(null, newDoc);
      return await TransferStock.findById(newDoc._id).populate("admin");
    },

    editTransferStock: async (_: any, { id, input }: any, context: any) => {
      const oldDoc = await TransferStock.findById(id);
      if (!oldDoc) throw new Error("Transfer stock not found");

      const { user } = context;
      // Preserve the original createdby_name; only update with client value if provided
      const createdbyData = {
        createdby_name: input.createdby_name || oldDoc.createdby_name || user?.name || user?.email,
      };

      const newDoc = await TransferStock.findByIdAndUpdate(id, { ...input, ...createdbyData }, { new: true });
      if (oldDoc && newDoc) await TransferStock.adjustStock(oldDoc, newDoc);

      return await TransferStock.findById(newDoc?._id).populate("admin");
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
