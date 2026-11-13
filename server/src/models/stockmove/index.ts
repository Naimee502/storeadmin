import mongoose, { Schema } from "mongoose";

// Stock ledger: one row per stock movement, written once and never changed.
// qty is in base units (+ in, - out); balance is the branch stock right after the move.
const stockMoveSchema = new Schema(
  {
    adminid: { type: Schema.Types.ObjectId, ref: "Admin", required: true },
    branchid: { type: Schema.Types.ObjectId, ref: "Branch" },
    productid: { type: Schema.Types.ObjectId, ref: "ProductService", required: true },
    variantid: { type: Schema.Types.ObjectId },
    qty: { type: Number, required: true },
    balance: { type: Number },
    // SalesInvoice, PurchaseInvoice, SalesReturn, PurchaseReturn, DeliveryChallan, TransferStock,
    // StockAdjustment, ProductionEntry, JobCard, Appointment, Product, Import, Opening
    doctype: { type: String, required: true },
    docid: { type: Schema.Types.ObjectId },
    docno: { type: String },
    date: { type: Date },
    note: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
stockMoveSchema.index({ adminid: 1, productid: 1, variantid: 1, branchid: 1, createdAt: 1 });
stockMoveSchema.index({ adminid: 1, docid: 1 });

export const StockMove = mongoose.model("StockMove", stockMoveSchema);

export type MoveInfo = { doctype: string; docid?: any; docno?: string; date?: any; note?: string };

/** Ledger context of a document. */
export const moveOf = (doc: any, doctype: string, note?: string): MoveInfo => ({
  doctype,
  docid: doc?._id,
  docno: doc?.billnumber || doc?.transferno || doc?.adjustmentno || undefined,
  date: doc?.billdate || doc?.transferdate || doc?.adjustmentdate || doc?.date || undefined,
  note,
});

/**
 * Ledger row for a balance change. The first row of an item at a branch is preceded by an
 * "Opening" row holding the balance before it, so older history needs no back-fill.
 * Best-effort: a ledger failure never stops the bill.
 */
export const recordStockMove = async (
  ids: { adminid: any; branchid: any; productid: any; variantid?: any },
  before: number,
  after: number,
  move?: MoveInfo
) => {
  if (!move || !ids.adminid || !(Number.isFinite(before) && Number.isFinite(after)) || after === before) return;
  try {
    const where = { adminid: ids.adminid, productid: ids.productid, variantid: ids.variantid ?? null, branchid: ids.branchid };
    const rows: any[] = [];
    if (!(await StockMove.exists(where)) && before !== 0) {
      rows.push({ ...where, qty: before, balance: before, doctype: "Opening", note: "Balance when the ledger started" });
    }
    const d = move.date ? new Date(move.date) : undefined;
    rows.push({ ...where, qty: after - before, balance: after, ...move, date: d && !isNaN(d.getTime()) ? d : new Date() });
    await StockMove.insertMany(rows, { ordered: false });
  } catch (e: any) {
    console.error("Stock ledger row not written:", e?.message);
  }
};
