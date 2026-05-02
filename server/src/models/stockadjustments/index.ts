import mongoose, { Document, Types } from "mongoose";

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
  adjustmentdate: Date;
  type: "Shortage" | "Excess";
  reason: string;
  items: IStockAdjustmentItem[];
  totalamount: number;
  status: boolean;
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
    adjustmentdate: { type: Date, required: true, default: Date.now },
    type: { type: String, enum: ["Shortage", "Excess"], required: true },
    reason: { type: String },
    items: [stockAdjustmentItemSchema],
    totalamount: { type: Number, required: true, default: 0 },
    status: { type: Boolean, default: true }
  },
  { timestamps: true }
);

// Auto-generate vouchernumber
stockAdjustmentSchema.pre("validate", async function (next) {
  if (!this.vouchernumber) {
    try {
      const Model = mongoose.model("StockAdjustment");
      const lastDoc = await Model.findOne({
        adminid: this.adminid,
        branchid: this.branchid
      }).sort({ createdAt: -1 });

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

export const StockAdjustment = mongoose.model<IStockAdjustment>("StockAdjustment", stockAdjustmentSchema);
