import mongoose from "mongoose";

const { ObjectId } = mongoose.Schema.Types;

// Stock of one batch of an item at a branch, in base units. Item stock itself stays in ProductBranchStock.
const batchStockSchema = new mongoose.Schema(
  {
    adminid: { type: ObjectId, ref: "Admin", required: true },
    branchid: { type: ObjectId, ref: "Branch", required: true },
    productid: { type: ObjectId, ref: "ProductService", required: true },
    variantid: { type: ObjectId },
    batchno: { type: String, required: true },
    // YYYY-MM-DD
    expirydate: { type: String },
    mfgdate: { type: String },
    qty: { type: Number, default: 0 },
  },
  { timestamps: true }
);
batchStockSchema.index({ adminid: 1, branchid: 1, productid: 1, variantid: 1, batchno: 1 }, { unique: true });
batchStockSchema.index({ adminid: 1, expirydate: 1 });

// One line per change of a batch by a document; a document's lines add up to what it moves now.
const batchMoveSchema = new mongoose.Schema(
  {
    adminid: { type: ObjectId, ref: "Admin", required: true },
    branchid: { type: ObjectId, ref: "Branch", required: true },
    productid: { type: ObjectId, ref: "ProductService", required: true },
    variantid: { type: ObjectId },
    batchno: { type: String, required: true },
    qty: { type: Number, required: true },
    docmodel: { type: String, required: true },
    docid: { type: ObjectId, required: true },
    docno: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
batchMoveSchema.index({ docid: 1 });
batchMoveSchema.index({ adminid: 1, productid: 1, branchid: 1, batchno: 1 });

export const BatchStock = mongoose.model("BatchStock", batchStockSchema);
export const BatchMove = mongoose.model("BatchMove", batchMoveSchema);
