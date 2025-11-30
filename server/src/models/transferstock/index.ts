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
    variantid: { type: Schema.Types.ObjectId },
    transferunitid: { type: Schema.Types.ObjectId, ref: 'Unit' },
    batchnumber: { type: String },
    transferqty: { type: Number, required: true },
    transferdate: { type: String, required: true },
    status: { type: Boolean, default: true },
    admin: { type: Schema.Types.ObjectId, ref: 'Admin', required: true },
  },
  { timestamps: true }
);

/**
 * Adjust stock in ProductBranchStock safely
 */
transferStockSchema.statics.adjustStock = async function (
  oldDoc: ITransferStock | null,
  newDoc: ITransferStock | null
) {
  const adjustBranchStock = async (
    branchId: Types.ObjectId,
    productId: Types.ObjectId,
    variantId: Types.ObjectId | undefined,
    qty: number
  ) => {
    let stock = await ProductBranchStock.findOne({
      productid: productId,
      branchid: branchId,
      variantid: variantId || null,
    });

    if (!stock) {
      stock = await ProductBranchStock.create({
        productid: productId,
        branchid: branchId,
        variantid: variantId || null,
        openingstock: 0,
        currentstock: 0,
        closingstock: 0,
        openingstockamount: 0,
        currentstockamount: 0,
        closingstockamount: 0,
        averagecost: 0,
      });
    }

    stock.currentstock += qty;
    await stock.save();
  };

  const convertQty = async (
    qty: number,
    variantId?: Types.ObjectId,
    unitId?: Types.ObjectId
  ) => {
    if (!variantId || !unitId) return qty;

    const product = await ProductService.findById(newDoc?.productid || oldDoc?.productid);
    if (!product) return qty;

    const variant = product.productvariants?.find(
      (v) => String(v._id) === String(variantId)
    );
    if (!variant) return qty;

    return convertToBaseUnit(qty, unitId, variant);
  };

  // 🔹 Revert old transfer
  if (oldDoc) {
    const oldQty = await convertQty(oldDoc.transferqty, oldDoc.variantid, oldDoc.transferunitid);

    // Return stock to from branch
    await adjustBranchStock(oldDoc.frombranchid, oldDoc.productid, oldDoc.variantid, oldQty);

    // Deduct stock from to branch
    await adjustBranchStock(oldDoc.tobranchid, oldDoc.productid, oldDoc.variantid, -oldQty);
  }

  // 🔹 Apply new transfer
  if (newDoc) {
    const newQty = await convertQty(newDoc.transferqty, newDoc.variantid, newDoc.transferunitid);

    // Deduct stock from from branch
    await adjustBranchStock(newDoc.frombranchid, newDoc.productid, newDoc.variantid, -newQty);

    // Add stock to to branch
    await adjustBranchStock(newDoc.tobranchid, newDoc.productid, newDoc.variantid, newQty);
  }
};

// ✅ Export model
export const TransferStock = mongoose.model<ITransferStock, TransferStockModel>(
  'TransferStock',
  transferStockSchema
);
