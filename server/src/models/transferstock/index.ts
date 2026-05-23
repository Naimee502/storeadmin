import mongoose, { Model, Schema, Document, Types } from 'mongoose';
import { ProductBranchStock } from '../productbranchstock';
import { convertToBaseUnit } from '../../utils/unitconversation';
import { ProductService } from '../products';

// ─── Interfaces ────────────────────────────────────────────────────────────────

export interface ITransferStockItem {
  productid: Types.ObjectId;
  variantid?: Types.ObjectId;
  transferunitid?: Types.ObjectId;
  transferqty: number;
  rate: number;
  amount: number;
}

interface ITransferStock extends Document {
  vouchernumber?: string;
  frombranchid: Types.ObjectId;
  tobranchid: Types.ObjectId;
  transferdate: string;
  narration?: string;
  items: ITransferStockItem[];
  totalamount: number;
  createdby_id?: Types.ObjectId;
  createdby_name?: string;
  createdby_type?: string;
  status: boolean;
  admin: Types.ObjectId;
}

interface TransferStockModel extends Model<ITransferStock> {
  adjustStock(oldDoc: ITransferStock | null, newDoc: ITransferStock | null): Promise<void>;
}

// ─── Sub-schema for each transferred item ─────────────────────────────────────

const transferStockItemSchema = new Schema<ITransferStockItem>(
  {
    productid:      { type: Schema.Types.ObjectId, ref: 'ProductService', required: true },
    variantid:      { type: Schema.Types.ObjectId },
    transferunitid: { type: Schema.Types.ObjectId, ref: 'Unit' },
    transferqty:    { type: Number, required: true, min: 0 },
    rate:           { type: Number, default: 0 },
    amount:         { type: Number, default: 0 },
  },
  { _id: false }
);

// ─── Main schema ──────────────────────────────────────────────────────────────

const transferStockSchema = new Schema<ITransferStock, TransferStockModel>(
  {
    vouchernumber: { type: String },
    frombranchid:  { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
    tobranchid:    { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
    transferdate:  { type: String, required: true },
    narration:     { type: String },
    items:         { type: [transferStockItemSchema], default: [] },
    totalamount:   { type: Number, default: 0 },

    createdby_id:   { type: Schema.Types.ObjectId },
    createdby_name: { type: String },
    createdby_type: { type: String },

    status: { type: Boolean, default: true },
    admin:  { type: Schema.Types.ObjectId, ref: 'Admin', required: true },
  },
  { timestamps: true }
);

// ─── Auto-generate vouchernumber (#TS0001) ────────────────────────────────────

transferStockSchema.pre('save', async function (next) {
  if (!this.vouchernumber) {
    const Model = mongoose.model('TransferStock');
    const last = await Model.findOne({ admin: this.admin }).sort({ createdAt: -1 });
    let nextNum = 1;
    if (last?.vouchernumber && /^#TS\d{4,}$/.test(last.vouchernumber)) {
      nextNum = parseInt(last.vouchernumber.replace('#TS', ''), 10) + 1;
    }
    this.vouchernumber = `#TS${String(nextNum).padStart(4, '0')}`;
  }
  next();
});

// ─── Static: adjust stock across both branches for all items ─────────────────

transferStockSchema.statics.adjustStock = async function (
  oldDoc: ITransferStock | null,
  newDoc: ITransferStock | null
) {
  const adminId: Types.ObjectId = (newDoc?.admin || oldDoc?.admin) as Types.ObjectId;

  // Adjust a single branch-stock record by `delta` (positive = increase, negative = decrease)
  const adjustBranchStock = async (
    branchId: Types.ObjectId,
    productId: Types.ObjectId,
    variantId: Types.ObjectId | undefined,
    delta: number
  ) => {
    let stock = await ProductBranchStock.findOne({
      adminid: adminId,
      productid: productId,
      branchid: branchId,
      variantid: variantId || null,
    });

    if (!stock) {
      stock = await ProductBranchStock.create({
        adminid: adminId,
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

    stock.currentstock += delta;
    stock.closingstock = stock.currentstock;
    await stock.save();
  };

  // Convert transfer qty to base units using product variant's unit conversions
  const toBaseQty = async (item: ITransferStockItem): Promise<number> => {
    if (!item.variantid || !item.transferunitid) return item.transferqty;
    const product = await ProductService.findById(item.productid);
    if (!product) return item.transferqty;
    const variant = product.productvariants?.find(
      (v: any) => String(v._id) === String(item.variantid)
    );
    if (!variant) return item.transferqty;
    return convertToBaseUnit(item.transferqty, item.transferunitid, variant);
  };

  // Revert old transfer: return stock to from-branch, remove from to-branch
  if (oldDoc) {
    for (const item of oldDoc.items) {
      const qty = await toBaseQty(item);
      await adjustBranchStock(oldDoc.frombranchid, item.productid, item.variantid, +qty);
      await adjustBranchStock(oldDoc.tobranchid,   item.productid, item.variantid, -qty);
    }
  }

  // Apply new transfer: deduct from from-branch, add to to-branch
  if (newDoc) {
    for (const item of newDoc.items) {
      const qty = await toBaseQty(item);
      await adjustBranchStock(newDoc.frombranchid, item.productid, item.variantid, -qty);
      await adjustBranchStock(newDoc.tobranchid,   item.productid, item.variantid, +qty);
    }
  }
};

// ─── Export ───────────────────────────────────────────────────────────────────

export const TransferStock = mongoose.model<ITransferStock, TransferStockModel>(
  'TransferStock',
  transferStockSchema
);
