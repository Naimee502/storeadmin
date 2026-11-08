import mongoose, { Document, Types } from "mongoose";
import { NUMERIC_COLLATION } from "../../utils/billnumber";

export interface IStockAdjustmentItem {
  productid: Types.ObjectId;
  variantid?: Types.ObjectId;
  quantity: number;
  rate: number;
  amount: number;
}

export interface IStockAdjustment extends Document {
  adminid: Types.ObjectId;
  branchid: Types.ObjectId;
  vouchernumber: string;
  clientRequestId?: string;
  offlineNumber?: string;
  adjustmentdate: Date;
  type: "Shortage" | "Excess";
  reason: string;
  items: IStockAdjustmentItem[];
  totalamount: number;
  createdby_id?: Types.ObjectId;
  createdby_name?: string;
  createdby_type?: string;
  status: boolean;
  /** True once a delete/cancel has reversed this voucher's stock. Restore only
   *  re-applies stock when it was actually reversed (legacy deletes weren't). */
  stockreversed?: boolean;
}

const stockAdjustmentItemSchema = new mongoose.Schema({
  productid: { type: mongoose.Schema.Types.ObjectId, ref: "ProductService", required: true },
  variantid: { type: mongoose.Schema.Types.ObjectId },
  quantity: { type: Number, required: true },
  rate: { type: Number, required: true },
  amount: { type: Number, required: true }
});

const stockAdjustmentSchema = new mongoose.Schema(
  {
    adminid: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true },
    branchid: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", required: true },
    vouchernumber: { type: String, required: true },
    clientRequestId: { type: String }, // offline sync de-duplication
    offlineNumber: { type: String }, // provisional device number the document was made offline with
    adjustmentdate: { type: Date, required: true, default: Date.now },
    type: { type: String, enum: ["Shortage", "Excess"], required: true },
    reason: { type: String },
    items: [stockAdjustmentItemSchema],
    totalamount: { type: Number, required: true, default: 0 },

    createdby_id: { type: mongoose.Schema.Types.ObjectId },
    createdby_name: { type: String },
    createdby_type: { type: String },

    status: { type: Boolean, default: true },
    stockreversed: { type: Boolean, default: false }
  },
  { timestamps: true }
);

// Auto-generate vouchernumber
stockAdjustmentSchema.pre("validate", async function (next) {
  if (!this.vouchernumber) {
    try {
      const Model = mongoose.model("StockAdjustment");
      // Highest main-series number; device numbers ("SA-A/000001") never match.
      const lastDoc = await Model.findOne({
        adminid: this.adminid,
        branchid: this.branchid,
        vouchernumber: { $regex: /^#SA\d{4,}$/ },
      }).collation(NUMERIC_COLLATION).sort({ vouchernumber: -1 });

      let nextNum = 1;
      if (lastDoc && lastDoc.vouchernumber && /^#SA\d{4,}$/.test(lastDoc.vouchernumber)) {
        nextNum = parseInt(lastDoc.vouchernumber.replace("#SA", "")) + 1;
      }
      this.vouchernumber = `#SA${String(nextNum).padStart(4, "0")}`;
    } catch (err) {
      console.error(err);
    }
  }
  next();
});

// One document per offline request id; only rows that carry one are indexed.
stockAdjustmentSchema.index(
  { adminid: 1, clientRequestId: 1 },
  { unique: true, partialFilterExpression: { clientRequestId: { $type: "string" } } }
);

export const StockAdjustment = mongoose.model<IStockAdjustment>("StockAdjustment", stockAdjustmentSchema);
