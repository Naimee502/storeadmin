import mongoose from 'mongoose';
import { recordStockMove, type MoveInfo } from '../stockmove';

const productBranchStockSchema = new mongoose.Schema({
  adminid: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
  },
  productid: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ProductService', // or 'Product' if your model name is Product
    required: true
  },
  variantid: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ProductServiceVariant', // add your variant model name here
    required: false // optional, since some products may not have variants
  },
  branchid: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch',
    required: true
  },
  openingstock: {
    type: Number,
    required: true
  },
  openingstockamount: {
    type: Number,
    default: 0
  },
  currentstock: {
    type: Number,
    default: 0
  },
  currentstockamount: {
    type: Number,
    default: 0
  },
  closingstock: {
    type: Number,
    default: 0
  },
  closingstockamount: {
    type: Number,
    default: 0
  },
  minimumstock: {
    type: Number,
    default: 0
  }, 
  reorderlevel: { 
    type: Number, 
    default: 0 
  }, 
  averagecost: 
  { 
    type: Number, 
    default: 0 
  }
}, { timestamps: true });

// Ensure uniqueness branch + product + variant
productBranchStockSchema.index(
  { productid: 1, variantid: 1, branchid: 1 },
  { unique: true }
);

export const ProductBranchStock = mongoose.model(
  'ProductBranchStock',
  productBranchStockSchema
);

/**
 * Read a stock row, compute its new values, and write them only if nobody changed the row
 * in between (two bills at once would otherwise lose one movement). Retries on a clash.
 * `compute` gets the row (null when missing) and returns the fields to set, or null to skip.
 */
export const writeStockRow = async (
  key: Record<string, any>,
  compute: (row: any) => Record<string, any> | null,
  opts: { upsert?: boolean; onInsert?: Record<string, any>; move?: MoveInfo } = {}
) => {
  const log = (row: any, set: any) => recordStockMove(
    { adminid: set.adminid ?? row?.adminid ?? key.adminid, branchid: key.branchid, productid: key.productid, variantid: key.variantid },
    Number(row?.currentstock ?? 0),
    Number(set.currentstock ?? row?.currentstock ?? 0),
    opts.move
  );
  for (let attempt = 0; attempt < 30; attempt++) {
    if (attempt) await new Promise((r) => setTimeout(r, Math.random() * 20 * Math.min(attempt, 5)));
    const row: any = await ProductBranchStock.findOne(key);
    const set = compute(row);
    if (!set) return;
    try {
      if (!row) {
        if (!opts.upsert) return;
        // $setOnInsert: if another bill created the row meanwhile, nothing is overwritten and we retry.
        const res = await ProductBranchStock.updateOne(key, { $setOnInsert: { ...opts.onInsert, ...set } }, { upsert: true });
        if (res.upsertedCount) return log(null, set);
      } else {
        const filter = {
          _id: row._id,
          updatedAt: row.updatedAt ?? null,
          currentstock: row.$isDefault("currentstock") ? null : row.currentstock,
        };
        const res = await ProductBranchStock.updateOne(filter, { $set: set });
        if (res.matchedCount) return log(row, set);
      }
    } catch (e: any) {
      if (e?.code !== 11000) throw e;
    }
  }
  throw new Error("Stock was being changed by another entry at the same moment. Please save again.");
};
