import mongoose from "mongoose";

// ChargeRule
// ----------
// Admin-configurable, dynamic charges (Amazon / Flipkart style) such as
// Delivery Charge, Handling Fee, COD Fee, Packaging, etc. Each rule says
// HOW MUCH to charge and WHEN it applies. The Sales Order create flow
// evaluates all active rules and auto-appends the matching ones as
// `othercharges` lines — so app AND website orders pick them up
// automatically without any client-side logic.
const chargeRuleSchema = new mongoose.Schema(
  {
    adminid: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
      index: true,
    },

    // Display label, e.g. "Delivery Charge", "COD Fee".
    name: { type: String, required: true },

    // Ledger this charge is posted to when an invoice is created.
    ledgerid: { type: mongoose.Schema.Types.ObjectId, ref: "AccountLedger" },

    // "flat"    → fixed `value` rupees.
    // "percent" → `value`% of the order base (subtotal).
    chargeType: { type: String, enum: ["flat", "percent"], default: "flat" },
    value: { type: Number, required: true, default: 0 },
    gstpercent: { type: Number, default: 0 },

    // ── Conditions (all must pass for the rule to apply) ──
    // Apply only when order base ≥ this (0 = no minimum).
    minOrderValue: { type: Number, default: 0 },
    // Waive the charge when order base ≥ this (0 = never free).
    freeAboveValue: { type: Number, default: 0 },
    // Who triggered the order: party / salesman / staff / website / admin.
    // Empty array = applies to everyone.
    applyToCreatorTypes: { type: [String], default: [] },
    // Payment types this applies to (e.g. ["cod"]). Empty = all.
    paymentTypes: { type: [String], default: [] },
    // If true, only apply when the business deliveryMode is "deliveryboy".
    onlyWhenDeliveryBoy: { type: Boolean, default: false },

    // Lower number = evaluated first (display ordering only; rules stack).
    priority: { type: Number, default: 0 },

    active: { type: Boolean, default: true },
    // Soft-delete flag (consistent with the rest of the codebase).
    status: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const ChargeRule = mongoose.model("ChargeRule", chargeRuleSchema);
