import mongoose, { Schema } from "mongoose";

// What changed in the business, found from its own data. One row per thing and kind.

const insightSchema = new Schema(
  {
    adminid: { type: Schema.Types.ObjectId, ref: "Admin", required: true },
    branchid: { type: Schema.Types.ObjectId, ref: "Branch" },
    // slipping, paymentrisk, stoppeditem, stockout
    kind: { type: String, required: true },
    dedupekey: { type: String, required: true },
    partyacc: { type: Schema.Types.ObjectId, ref: "Account" },
    productid: { type: Schema.Types.ObjectId, ref: "ProductService" },
    variantid: { type: Schema.Types.ObjectId },
    name: { type: String },
    mobile: { type: String },
    city: { type: String },
    title: { type: String },
    reason: { type: String },
    // The rows the owner checks the claim against; without these the card is not shown.
    evidence: [{ label: String, detail: String, amount: Number, _id: false }],
    // 0-100, highest first.
    score: { type: Number },
    // Rupees at stake; the list is ranked by this.
    value: { type: Number },
    dueAt: { type: Date },
    lastorderAt: { type: Date },
    draftmessage: { type: String },
    // open, done, dismissed
    state: { type: String, default: "open" },
    actedby_name: { type: String },
    actedAt: { type: Date },
    foundAt: { type: Date },
    status: { type: Boolean, default: true },
    cleared: { type: Boolean },
  },
  { timestamps: true }
);
insightSchema.index({ adminid: 1, dedupekey: 1 }, { unique: true });
insightSchema.index({ adminid: 1, state: 1, value: -1 });

export const Insight = mongoose.model("Insight", insightSchema);
