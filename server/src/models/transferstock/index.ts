import mongoose, { Model, Schema, Document, Types } from 'mongoose';
import { ProductBranchStock } from '../productbranchstock';
import { convertToBaseUnit } from '../../utils/unitconversation';
import { ProductService } from '../products';

interface ITransferStock extends Document {
  frombranchid: Types.ObjectId;
  tobranchid: Types.ObjectId;
  productid: Types.ObjectId;
  variantid?: Types.ObjectId;
  transferunitid?: Types.ObjectId;
  batchnumber?: string;
  transferqty: number;
  transferdate: string;
  status?: boolean;
  admin: Types.ObjectId;
}

interface TransferStockModel extends Model<ITransferStock> {
  adjustStock: (oldDoc: ITransferStock | null, newDoc: ITransferStock | null) => Promise<void>;
}

const transferStockSchema = new Schema<ITransferStock, TransferStockModel>(
  {
    frombranchid: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
    tobranchid: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
    productid: { type: Schema.Types.ObjectId, ref: 'ProductService', required: true },
    variantid: { type: Schema.Types.ObjectId }, // optional variant
    batchnumber: { type: String }, // optional batch
    transferqty: { type: Number, required: true },
    transferdate: { type: String, required: true },
    status: { type: Boolean, default: true },
    admin: { type: Schema.Types.ObjectId, ref: 'Admin', required: true },
  },
  { timestamps: true }
);

/**
 * Adjust stock in ProductBranchStock based on transfer
 * @param oldDoc - previous transfer doc (for edits)
 * @param newDoc - new transfer doc
 */
transferStockSchema.statics.adjustStock = async function (
  oldDoc: ITransferStock | null,
  newDoc: ITransferStock | null
) {
  const ops: any[] = [];

  const convertQty = async (qty: number, variantId?: Types.ObjectId, unitId?: Types.ObjectId) => {
    if (!variantId || !unitId) return qty; // fallback
    const product = await ProductService.findById(newDoc?.productid || oldDoc?.productid);
    if (!product) return qty;
    const variant = product.productvariants?.find(v => String(v._id) === String(variantId));
    if (!variant) return qty;

    // Convert to base unit using transferunitid (same as salesInvoice logic)
    return convertToBaseUnit(qty, unitId, variant);
  };

  // 🔹 Revert old transfer
  if (oldDoc) {
    const oldQty = await convertQty(oldDoc.transferqty, oldDoc.variantid, oldDoc.transferunitid);

    // Return stock to from branch
    ops.push({
      updateOne: {
        filter: {
          productid: oldDoc.productid,
          branchid: oldDoc.frombranchid,
          variantid: oldDoc.variantid || null,
        },
        update: { $inc: { currentstock: oldQty } },
      },
    });

    // Deduct stock from to branch
    ops.push({
      updateOne: {
        filter: {
          productid: oldDoc.productid,
          branchid: oldDoc.tobranchid,
          variantid: oldDoc.variantid || null,
        },
        update: { $inc: { currentstock: -oldQty } },
      },
    });
  }

  // 🔹 Apply new transfer
  if (newDoc) {
    const newQty = await convertQty(newDoc.transferqty, newDoc.variantid, newDoc.transferunitid);

    // Deduct stock from from branch
    ops.push({
      updateOne: {
        filter: {
          productid: newDoc.productid,
          branchid: newDoc.frombranchid,
          variantid: newDoc.variantid || null,
        },
        update: { $inc: { currentstock: -newQty } },
        upsert: true,
      },
    });

    // Add stock to to branch
    ops.push({
      updateOne: {
        filter: {
          productid: newDoc.productid,
          branchid: newDoc.tobranchid,
          variantid: newDoc.variantid || null,
        },
        update: { $inc: { currentstock: newQty } },
        upsert: true,
      },
    });
  }

  if (ops.length > 0) {
    await ProductBranchStock.bulkWrite(ops);
  }
};

// ✅ Export model
export const TransferStock = mongoose.model<ITransferStock, TransferStockModel>(
  'TransferStock',
  transferStockSchema
);
