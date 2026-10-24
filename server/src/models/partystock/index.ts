import mongoose from "mongoose";

/**
 * Stock a PARTY holds (Business Settings → "Track party stock", with Party
 * manages downline on). Kept apart from ProductBranchStock, which is the
 * company's own stock and is never touched by this.
 *
 * One row per party + product + variant, quantity in the variant's BASE unit
 * (the same unit ProductBranchStock uses). Moved by Sales Invoices:
 *   company → direct party : branch stock −, buyer party stock +
 *   parent  → sub-party    : parent party stock −, sub-party stock +
 */
const partyStockSchema = new mongoose.Schema(
  {
    adminid: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true },
    partyid: { type: mongoose.Schema.Types.ObjectId, ref: "Account", required: true },
    productid: { type: mongoose.Schema.Types.ObjectId, ref: "ProductService", required: true },
    variantid: { type: mongoose.Schema.Types.ObjectId, default: null },
    qty: { type: Number, default: 0 },
  },
  { timestamps: true }
);

partyStockSchema.index({ partyid: 1, productid: 1, variantid: 1 }, { unique: true });
partyStockSchema.index({ adminid: 1, partyid: 1 });

export const PartyStock = mongoose.model("PartyStock", partyStockSchema);
