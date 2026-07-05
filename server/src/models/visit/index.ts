import mongoose from "mongoose";

/**
 * Visit / Call record — one document per salesman visit attempt to a party on a
 * route day. `visited: true` = positive call (party visited), `visited: false`
 * = negative call (assigned on the route day but not visited).
 *
 * The salesman app is expected to create these as the rep works the route. The
 * admin Salesman Field Report aggregates them (visited / non-visited counts,
 * day-wise, route-wise) and surfaces GPS where captured.
 */
const visitSchema = new mongoose.Schema(
  {
    adminid: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true },
    branchid: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", default: null },

    salesmanid: { type: mongoose.Schema.Types.ObjectId, ref: "StaffAccount", required: true },
    partyacc: { type: mongoose.Schema.Types.ObjectId, ref: "Account", required: true },
    routeid: { type: mongoose.Schema.Types.ObjectId, ref: "SalesRoute", default: null },

    // YYYY-MM-DD of the visit, plus the weekday string (matches route visitdays).
    visitdate: { type: String, required: true },
    day: { type: String },

    // true = positive call (visited), false = negative call (not visited).
    visited: { type: Boolean, default: false },

    // Optional reason when not visited (shop closed, owner absent, etc.).
    reason: { type: String },
    notes: { type: String },

    // Whether the visit resulted in an order, and which one.
    ordercreated: { type: Boolean, default: false },
    orderid: { type: mongoose.Schema.Types.ObjectId, ref: "SalesOrder", default: null },

    // GPS captured at the time of the visit (filled once app tracking is live).
    latitude: { type: Number },
    longitude: { type: Number },
    visitedAt: { type: Date },

    createdby_id: { type: mongoose.Schema.Types.ObjectId },
    createdby_name: { type: String },
    createdby_type: { type: String },

    status: { type: Boolean, default: true },
  },
  { timestamps: true }
);

visitSchema.index({ adminid: 1, branchid: 1, salesmanid: 1, visitdate: 1 });

export const Visit = mongoose.model("Visit", visitSchema);
