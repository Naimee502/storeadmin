import mongoose from "mongoose";

// A device that bills offline. Each gets its own series code per business
// (A, B, ... Z, AA, ...) and numbers its documents "<code>/000001" etc.
const offlineDeviceSchema = new mongoose.Schema(
  {
    adminid: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true },
    branchid: { type: mongoose.Schema.Types.ObjectId, ref: "Branch" },
    code: { type: String, required: true },
    name: { type: String, required: true },
    createdby_id: { type: mongoose.Schema.Types.ObjectId },
    createdby_type: { type: String },
    lastSeen: { type: Date },
    // Highest sequence used per doc type: salesinvoice, salesorder, salesreturn, payment.
    lastSeq: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, minimize: false }
);

offlineDeviceSchema.index({ adminid: 1, code: 1 }, { unique: true });

export const OfflineDevice = mongoose.model("OfflineDevice", offlineDeviceSchema);
