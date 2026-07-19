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
    autoCreatePaymentOnSalesInvoice: { type: Boolean, default: true },
    autoCreateStockOnSalesInvoice: { type: Boolean, default: true },
    autoCreateLedgerOnPurchaseInvoice: { type: Boolean, default: true },
    autoCreatePaymentOnPurchaseInvoice: { type: Boolean, default: true },
    autoCreateStockOnPurchaseInvoice: { type: Boolean, default: true },
    autoCreateLedgerOnExpense: { type: Boolean, default: true },
    autoCreatePaymentOnExpense: { type: Boolean, default: true },
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
    companyState: { type: String, default: "gujarat" }, // For IGST vs CGST/SGST detection

    /* ============================================================
       INVOICE PRINT LAYOUT — lets an admin switch off parts of the
       printed Sales/Purchase Invoice header & footer, and customise the
       Terms & Conditions text shown on it.
       ============================================================ */
    printShowCompanyHeader: { type: Boolean, default: true }, // Company name/address/city/mobile block
    printShowCompanyNameInSignature: { type: Boolean, default: true }, // "For, <Company>" in the signature block
    printShowTermsAndConditions: { type: Boolean, default: true }, // Whether the T&C block prints at all
    printTermsAndConditions: {
      type: String,
      default:
        '1. Goods once sold will not be taken back.\n' +
        '2. Interest @18% p.a. will be charged if payment is not made within due date.\n' +
        '3. Our risk and responsibility ceases as soon as the goods leave our premises.\n' +
        '4. "Subject to RAJKOT Jurisdiction only. E.&.O.E"',
    },
    // Party's Previous Balance / Current Balance rows below Grand Total on
    // the printed Sales Invoice (like a running-account statement). New,
    // opt-in feature — off by default so existing invoices don't change.
    printShowPartyBalance: { type: Boolean, default: false },

    /* ============================================================
       FULFILMENT — who delivers orders for this business.
       "salesman"   → salesman hands over on the route (no delivery boy)
       "deliveryboy"→ end-user/party/website orders go to a delivery boy
       Channel-partner orders taken by a salesman are always salesman-fulfilled.
       ============================================================ */
    deliveryMode: {
      type: String,
      enum: ["salesman", "deliveryboy"],
      default: "salesman",
    },

    /* ============================================================
       CHANNEL DOWNLINE — when true, a channel party (e.g. wholesaler) can
       see/manage the orders & payments of the sub-parties under it
       (assignaccountid chain). Also drives the "Assign parent party" field
       on party add. Default off so existing tenants are unaffected.
       ============================================================ */
    partyManagesDownline: { type: Boolean, default: false },

    /* ============================================================
       PAYMENT DISCOUNT / COMMISSION — when true, the Add Payment screen
       lets the user enter a per-invoice Discount and Commission while
       settling a bill. The bill is fully cleared while cash received is
       lower; the difference posts to "Discount Allowed" / "Commission".
       Off by default so existing tenants are unaffected (feature is opt-in).
       ============================================================ */
    enablePaymentDiscountCommission: { type: Boolean, default: false },

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
