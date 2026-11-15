import mongoose from "mongoose";

// Jewellery: the day's rate of a metal and purity, per gram (one row per day; old days stay as history).
const metalRateSchema = new mongoose.Schema(
  {
    adminid: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true },
    // YYYY-MM-DD
    date: { type: String, required: true },
    // gold, silver, platinum or another the business uses
    metal: { type: String, required: true },
    purity: { type: String, required: true },
    rate: { type: Number, required: true },
    createdby_name: { type: String },
  },
  { timestamps: true }
);
metalRateSchema.index({ adminid: 1, metal: 1, purity: 1, date: -1 }, { unique: true });

export const MetalRate = mongoose.model("MetalRate", metalRateSchema);
