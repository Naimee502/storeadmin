import mongoose from "mongoose";

// One line per change to a party's loyalty points; the balance is their sum.
const loyaltyEntrySchema = new mongoose.Schema(
  {
    adminid: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true },
    partyid: { type: mongoose.Schema.Types.ObjectId, ref: "Account", required: true },
    // earn, redeem, expire, adjust
    kind: { type: String, required: true },
    points: { type: Number, required: true },
    amount: { type: Number },
    docmodel: { type: String },
    docid: { type: mongoose.Schema.Types.ObjectId },
    docno: { type: String },
    note: { type: String },
    createdby_name: { type: String },
  },
  { timestamps: true }
);
loyaltyEntrySchema.index({ adminid: 1, partyid: 1, createdAt: -1 });
loyaltyEntrySchema.index({ docmodel: 1, docid: 1 });

export const LoyaltyEntry = mongoose.model("LoyaltyEntry", loyaltyEntrySchema);
