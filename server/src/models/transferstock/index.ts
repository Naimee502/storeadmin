import mongoose, { Model, Schema, Document } from 'mongoose';
import { ProductBranchStock } from '../productbranchstock';

interface ITransferStock extends Document {
  frombranchid: mongoose.Types.ObjectId;
  tobranchid: mongoose.Types.ObjectId;
  productid: mongoose.Types.ObjectId;
  transferqty: number;
  transferdate: string;
  status?: boolean;
}

interface TransferStockModel extends Model<ITransferStock> {
  adjustStock: (oldDoc: ITransferStock | null, newDoc: ITransferStock) => Promise<void>;
}

const transferStockSchema = new Schema<ITransferStock, TransferStockModel>({
  frombranchid: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
  tobranchid: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
  productid: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  transferqty: { type: Number, required: true },
  transferdate: { type: String, required: true },
  status: { type: Boolean, default: true },
}, { timestamps: true });

transferStockSchema.statics.adjustStock = async function (
  oldDoc: ITransferStock | null,
  newDoc: ITransferStock
) {
  const ops: any[] = [];

  if (oldDoc) {
    ops.push(
      {
        updateOne: {
          filter: { productid: oldDoc.productid, branchid: oldDoc.frombranchid },
          update: { $inc: { currentstock: oldDoc.transferqty } },
        },
      },
      {
        updateOne: {
          filter: { productid: oldDoc.productid, branchid: oldDoc.tobranchid },
          update: { $inc: { currentstock: -oldDoc.transferqty } },
        },
      }
    );
  }

  if (newDoc) {
    ops.push(
      {
        updateOne: {
          filter: { productid: newDoc.productid, branchid: newDoc.frombranchid },
          update: { $inc: { currentstock: -newDoc.transferqty } },
          upsert: true,
        },
      },
      {
        updateOne: {
          filter: { productid: newDoc.productid, branchid: newDoc.tobranchid },
          update: { $inc: { currentstock: newDoc.transferqty } },
          upsert: true,
        },
      }
    );
  }

  if (ops.length > 0) {
    await ProductBranchStock.bulkWrite(ops);
  }
};

// ✅ Correctly typed export
export const TransferStock = mongoose.model<ITransferStock, TransferStockModel>('TransferStock', transferStockSchema);
