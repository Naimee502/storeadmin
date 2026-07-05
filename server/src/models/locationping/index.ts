import mongoose from "mongoose";

/**
 * LocationPing — a single GPS sample reported by a salesman / delivery boy's
 * app while on the field. A day's pings, ordered by time, reconstruct the
 * actual route travelled (for the live-location / route-trace section of the
 * field reports).
 *
 * NOTE: the mobile app does not send these yet. The schema + API are in place
 * so the app only has to start POSTing pings; the reports already read them.
 */
const locationPingSchema = new mongoose.Schema(
  {
    adminid: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true },
    branchid: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", default: null },
    staffid: { type: mongoose.Schema.Types.ObjectId, ref: "StaffAccount", required: true },
    role: { type: String }, // salesman | deliveryboy

    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    accuracy: { type: Number },
    speed: { type: Number },
    battery: { type: Number },

    // YYYY-MM-DD for fast day filtering + exact timestamp for ordering.
    pingdate: { type: String, required: true },
    pingedAt: { type: Date, default: Date.now },

    status: { type: Boolean, default: true },
  },
  { timestamps: true }
);

locationPingSchema.index({ adminid: 1, staffid: 1, pingdate: 1, pingedAt: 1 });

export const LocationPing = mongoose.model("LocationPing", locationPingSchema);
