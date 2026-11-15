import mongoose from "mongoose";

const { ObjectId } = mongoose.Schema.Types;

// One physical unit (IMEI / serial number) and where it is now: in stock, sold, or sent back to the vendor.
const serialStockSchema = new mongoose.Schema(
  {
    adminid: { type: ObjectId, ref: "Admin", required: true },
    productid: { type: ObjectId, ref: "ProductService", required: true },
    variantid: { type: ObjectId },
    serialno: { type: String, required: true },
    branchid: { type: ObjectId, ref: "Branch" },
    // instock, sold, returned (to the vendor)
    status: { type: String, required: true },
    purchasedocid: { type: ObjectId, ref: "PurchaseInvoice" },
    purchasedate: { type: String },
    vendorid: { type: ObjectId, ref: "Account" },
    saledocid: { type: ObjectId, ref: "SalesInvoice" },
    saledate: { type: String },
    customerid: { type: ObjectId, ref: "Account" },
    warrantytill: { type: String },
    // The sale it came back from, while a sales return holds it.
    returndocid: { type: ObjectId, ref: "SalesReturn" },
    lastsaledocid: { type: ObjectId },
    vendorreturndocid: { type: ObjectId, ref: "PurchaseReturn" },
  },
  { timestamps: true }
);
serialStockSchema.index({ adminid: 1, serialno: 1 }, { unique: true });
serialStockSchema.index({ adminid: 1, productid: 1, variantid: 1, status: 1 });

// History of a unit: which document did what to it.
const serialMoveSchema = new mongoose.Schema(
  {
    adminid: { type: ObjectId, ref: "Admin", required: true },
    serialno: { type: String, required: true },
    action: { type: String, required: true },
    docmodel: { type: String },
    docid: { type: ObjectId },
    docno: { type: String },
    partyid: { type: ObjectId, ref: "Account" },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
serialMoveSchema.index({ adminid: 1, serialno: 1, createdAt: 1 });

export const SerialStock = mongoose.model("SerialStock", serialStockSchema);
export const SerialMove = mongoose.model("SerialMove", serialMoveSchema);
