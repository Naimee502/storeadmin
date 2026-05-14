// AdminSettings
//
// One document per admin. Holds the org-wide flags that used to live as
// per-invoice / per-module toggles. The Sales Invoice and Purchase Invoice
// resolvers consult this on save so users no longer have to remember to
// flip "auto-create ledger / stock" on every voucher.
//
// `getOrCreateForAdmin(adminid)` is the canonical accessor — it lazy-creates
// the row with sane defaults the first time an admin reads it, so existing
// admins on legacy data don't blow up.

import mongoose from "mongoose";

const adminSettingsSchema = new mongoose.Schema(
  {
    adminid: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
      unique: true,
      index: true,
    },

    /* ============================================================
       AUTO-POSTING FLAGS — invoices/vouchers consult these instead
       of asking the user "autocreate yes/no?" on every save.
       ============================================================ */
    autoCreateLedgerOnSalesInvoice: { type: Boolean, default: true },
    autoCreateStockOnSalesInvoice: { type: Boolean, default: true },
    autoCreateLedgerOnPurchaseInvoice: { type: Boolean, default: true },
    autoCreateStockOnPurchaseInvoice: { type: Boolean, default: true },
    autoCreateLedgerOnExpense: { type: Boolean, default: true },
    autoCreateLedgerOnSalesReturn: { type: Boolean, default: true },
    autoCreateLedgerOnPurchaseReturn: { type: Boolean, default: true },

    /* ============================================================
       INVENTORY POLICIES
       ============================================================ */
    allowNegativeStock: { type: Boolean, default: false },
    preventDuplicateInvoiceNumbers: { type: Boolean, default: true },

    /* ============================================================
       DEFAULTS used by add-form pre-populate logic
       ============================================================ */
    defaultGstPercent: { type: Number, default: 0 },
    defaultPaymentType: {
      type: String,
      enum: ["cash", "bank", "credit", "upi", "card", "cheque"],
      default: "cash",
    },
    defaultTaxOrSupplyType: { type: String, default: "exclusive" },
    defaultBillType: { type: String, default: "tax" },

    /* ============================================================
       INVOICE NUMBER PREFIXES (Tally-style series control)
       ============================================================ */
    salesInvoicePrefix: { type: String, default: "INV-" },
    purchaseInvoicePrefix: { type: String, default: "PINV-" },
    salesReturnPrefix: { type: String, default: "CN-" },
    purchaseReturnPrefix: { type: String, default: "DN-" },
    salesOrderPrefix: { type: String, default: "SO-" },
    purchaseOrderPrefix: { type: String, default: "PO-" },
    expenseNotePrefix: { type: String, default: "#EXP" },

    /* ============================================================
       FEATURE TOGGLES — switch off whole subsystems for SMB admins
       who only want order-taking, not full accounting.
       ============================================================ */
    enableGst: { type: Boolean, default: true },

    // New Features
    displayProductPriceOnWebsite: { type: Boolean, default: true },
    encryptInvoicePrices: { type: Boolean, default: false },

    /* ============================================================
       SAAS GATING — allow/disallow the admin from seeing core tabs
       ============================================================ */
    allowAdminToManageBusinessSettings: { type: Boolean, default: true },
    allowAdminToManageModules: { type: Boolean, default: true },
    allowAdminToManagePermissions: { type: Boolean, default: true },
  },
  { timestamps: true }
);

adminSettingsSchema.statics.getOrCreateForAdmin = async function (adminid: any) {
  const existing = await this.findOne({ adminid });
  if (existing) return existing;
  return this.create({ adminid });
};

interface AdminSettingsModel extends mongoose.Model<any> {
  getOrCreateForAdmin(adminid: any): Promise<any>;
}

export const AdminSettings = mongoose.model<any, AdminSettingsModel>(
  "AdminSettings",
  adminSettingsSchema
);
