import mongoose from "mongoose";
import { TransferStock } from "../../../models/transferstock";
import { ProductService } from "../../../models/products";
import { ProductBranchStock } from "../../../models/productbranchstock";
import { convertToBaseUnit } from "../../../utils/unitconversation";

// Validate each item has sufficient stock in the from-branch before transferring
async function validateItemStock(items: any[], frombranchid: string, adminId: string) {
  for (const item of items) {
    const productId = new mongoose.Types.ObjectId(item.productid);
    const branchId  = new mongoose.Types.ObjectId(frombranchid);
    const adminOId  = new mongoose.Types.ObjectId(adminId);
    const variantId = item.variantid ? new mongoose.Types.ObjectId(item.variantid) : null;
    const unitId    = item.transferunitid ? new mongoose.Types.ObjectId(item.transferunitid) : null;

    // Resolve base-unit quantity accounting for unit conversion
    let qtyInBase = item.transferqty;
    if (variantId && unitId) {
      const product = await ProductService.findById(productId);
      const variant = product?.productvariants?.find(
        (v: any) => String(v._id) === String(variantId)
      );
      if (variant) {
        qtyInBase = convertToBaseUnit(item.transferqty, unitId, variant);
      }
    }

    const stock = await ProductBranchStock.findOne({
      adminid:   adminOId,
      productid: productId,
      branchid:  branchId,
      variantid: variantId,
    });

    const available = stock?.currentstock ?? 0;
    if (available < qtyInBase) {
      const product = await ProductService.findById(productId);
      throw new Error(
        `Insufficient stock for "${product?.name || 'product'}". ` +
        `Available: ${available}, Requested: ${qtyInBase} (base units).`
      );
    }
  }
}

export const transferStockResolvers = {
  Query: {
    getTransferStocks: async (
      _: any,
      { adminId, frombranchid }: { adminId?: string; frombranchid?: string },
      context: any
    ) => {
      const filter: any = { status: true };
      const { user } = context;

      if (user?.type === "branch") {
        filter.$or = [
          { createdby_type: "branch", createdby_id: user?.id },
          { frombranchid: user?.branch_id || user?.id },
        ];
      } else if (user?.type === "staff") {
        filter.createdby_id = user?.id;
      }

      if (adminId) filter.admin = new mongoose.Types.ObjectId(adminId);
      if (frombranchid) filter.frombranchid = new mongoose.Types.ObjectId(frombranchid);

      return await TransferStock.find(filter).populate("admin").sort({ createdAt: -1 });
    },

    getDeletedTransferStocks: async (
      _: any,
      { adminId, frombranchid }: { adminId?: string; frombranchid?: string },
      context: any
    ) => {
      const filter: any = { status: false };
      const { user } = context;

      if (user?.type === "branch") {
        filter.$or = [
          { createdby_type: "branch", createdby_id: user?.id },
          { frombranchid: user?.branch_id || user?.id },
        ];
      } else if (user?.type === "staff") {
        filter.createdby_id = user?.id;
      }

      if (adminId) filter.admin = new mongoose.Types.ObjectId(adminId);
      if (frombranchid) filter.frombranchid = new mongoose.Types.ObjectId(frombranchid);

      return await TransferStock.find(filter).populate("admin").sort({ createdAt: -1 });
    },

    getTransferStockById: async (_: any, { id, adminId }: { id: string; adminId?: string }) => {
      const filter: any = { _id: id };
      if (adminId) filter.admin = new mongoose.Types.ObjectId(adminId);
      return await TransferStock.findOne(filter).populate("admin");
    },
  },

  Mutation: {
    addTransferStock: async (_: any, { input }: any, context: any) => {
      const { user } = context;

      // Server-side stock validation before any DB writes
      if (input.admin && input.frombranchid) {
        await validateItemStock(input.items || [], input.frombranchid, input.admin);
      }

      const createdbyData = {
        createdby_id:   user?.id,
        createdby_name: input.createdby_name || user?.name || user?.email,
        createdby_type: user?.type || input.createdby_type || "admin",
      };

      const newDoc = await TransferStock.create({ ...input, ...createdbyData });
      await TransferStock.adjustStock(null, newDoc);
      return await TransferStock.findById(newDoc._id).populate("admin");
    },

    editTransferStock: async (_: any, { id, input }: any, context: any) => {
      const oldDoc = await TransferStock.findById(id);
      if (!oldDoc) throw new Error("Transfer stock voucher not found");

      const { user } = context;
      const createdbyData = {
        createdby_name: input.createdby_name || oldDoc.createdby_name || user?.name || user?.email,
      };

      const newDoc = await TransferStock.findByIdAndUpdate(
        id,
        { ...input, ...createdbyData },
        { new: true }
      );

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
        await TransferStock.adjustStock(null, result); // re-apply stock
      }
      return !!result;
    },
  },
};
