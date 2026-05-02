import mongoose from "mongoose";

const dayWiseAccountSchema = new mongoose.Schema(
  {
    day: {
      type: String,
      required: true,
    },
    accounts: [{ type: mongoose.Schema.Types.ObjectId, ref: "Account" }],
    visitorder: { type: Number, default: 0 },
  },
  { _id: false }
);

const salesRouteSchema = new mongoose.Schema(
  {
    adminid:  { type: mongoose.Schema.Types.ObjectId, ref: "Admin",        required: true },
    branchid: { type: mongoose.Schema.Types.ObjectId, ref: "Branch",       required: true },
    routecode: { type: String },
    routename:  { type: String, required: true },
    description: { type: String },
    // Multiple visit days stored as plain strings — no enum so Mongoose doesn't silently strip values
    visitdays: { type: [String], default: [] },
    salesmanid: { type: mongoose.Schema.Types.ObjectId, ref: "StaffAccount", required: true },
    // Union of all accounts across all days (for fast lookup)
    accounts: [{ type: mongoose.Schema.Types.ObjectId, ref: "Account" }],
    dayWiseAccounts: [dayWiseAccountSchema],
    status: { type: Boolean, default: true },
  },
  { timestamps: true }
);

salesRouteSchema.index({ adminid: 1, branchid: 1, routename: 1 }, { unique: true });

export const SalesRoute = mongoose.model("SalesRoute", salesRouteSchema);
