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

// Every product-image-ratio field below is a "w:h" string ("1:1", "3:4",
// "16:9", ...) or "" for "not picked, keep the previous fixed height".
// Validated by shape rather than a fixed list on purpose: the admin panel
// owns the menu of ratios, so adding one there never needs a server change.
const PRODUCT_IMAGE_RATIO_RULE = {
  type: String,
  default: "",
  match: [/^(\d{1,2}:\d{1,2})?$/, 'Ratio must look like "3:4"'],
};

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
    // Whether product stock ("In stock (N)", "Only X left", "Out of
    // stock") is shown on the app/website — same idea as the price flag
    // above, gating the visible text only. The underlying stock number
    // still blocks ordering past what's on hand regardless of this flag.
    displayStockOnWebsite: { type: Boolean, default: true },
    encryptInvoicePrices: { type: Boolean, default: false },
    companyState: { type: String, default: "gujarat" }, // For IGST vs CGST/SGST detection

    /* ============================================================
       WEBSITE STOREFRONT — controls for the customer-facing website.
       ============================================================ */
    // When true, clientweb's checkout only offers Cash on Delivery — UPI,
    // Card, Net Banking and Party/Business-account billing are hidden.
    websiteCodOnly: { type: Boolean, default: false },

    // Human-picked, URL-friendly handle for this admin's public website —
    // e.g. "rudra" → yourdomain.com/rudra. Distinct from `admincode`
    // (#ADM0001, auto-generated, used by clientapp's one-time device
    // setup) — this one is editable by the admin and meant to be shared
    // with customers, so it needs to be short and memorable, not a code.
    // Resolved by the public getStorefrontByStoreSlug query below, with no
    // login/mobile check — browsing a storefront is not sensitive like the
    // app's staff/party data access is.
    storeslug: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      lowercase: true,
      match: [/^[a-z0-9-]*$/, "Only lowercase letters, numbers and hyphens allowed"],
    },

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
    printShowEwayBillDistance: { type: Boolean, default: true },
    printShowDeliveryDueDate: { type: Boolean, default: true },
    printShowGstin: { type: Boolean, default: true },
    printShowHsnColumn: { type: Boolean, default: true },
    printShowGstColumn: { type: Boolean, default: true },
    printShowTotalGst: { type: Boolean, default: true },

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
       DIRECT / ON-ACCOUNT SETTLEMENT — how a payment entered as a plain
       amount (no invoice ticked) is spread over the party's open bills.
         "off"    → nothing is allocated; the cash sits On Account until
                    somebody adjusts it by hand.
         "ask"    → allocation is proposed and shown for confirmation
                    before saving (default — Tally never allocates silently).
         "always" → allocated on save without a prompt.
       ============================================================ */
    paymentAutoSettlement: { type: String, enum: ["off", "ask", "always"], default: "ask" },
    paymentAllocationOrder: { type: String, enum: ["fifo", "lifo"], default: "fifo" },

    // When a new invoice is raised, apply any advance the party has already
    // paid. Allocation-only: the ledger was credited when the advance arrived.
    autoAdjustAdvanceOnInvoice: { type: Boolean, default: true },

    /* ============================================================
       SAAS GATING — allow/disallow the admin from seeing core tabs
       ============================================================ */
    allowAdminToManageBusinessSettings: { type: Boolean, default: true },
    allowAdminToManageModules: { type: Boolean, default: true },
    allowAdminToManagePermissions: { type: Boolean, default: true },

    /* ============================================================
       SCREEN CAPTURE PROTECTION — stops someone screen-sharing or
       recording the product to give an unauthorised demo.
       Default OFF everywhere, so the owner can still demo it themselves
       by leaving these off (or flipping one off temporarily).

       ⚠️  What each flag can ACTUALLY do differs by platform, and the
       difference matters — do not assume "on" means "safe":

       secureScreenApp
         Android: real. Sets FLAG_SECURE on the activity window, so
         screen share, screen recording AND screenshots all come out
         black. Enforced by the OS; nothing in JS can bypass it.
         iOS: best-effort. There is no FLAG_SECURE. We watch
         UIScreen.isCaptured and cover the app with a black view while a
         recording/mirroring session is live. A still screenshot cannot
         be blocked, only detected after the fact.

       secureScreenAdmin
         In a plain browser tab: NOT enforceable. No browser exposes
         "am I being screen-shared" to the page — the isScreenCaptured
         proposal is still just a proposal, and is planned to be
         allowlisted to financial institutions. So here this flag only
         drives the tiled watermark (who is logged in + when), which
         makes a leaked recording traceable rather than impossible.
         In the Electron desktop build: real. The renderer calls
         setContentProtection(true), which on Windows 10 2004+ removes
         the window from capture entirely.

       secureScreenWebsite
         Customer-facing storefront in a browser — watermark only, same
         browser limitation as above.
       ============================================================ */
    secureScreenApp: { type: Boolean, default: false },
    secureScreenAdmin: { type: Boolean, default: false },
    secureScreenWebsite: { type: Boolean, default: false },

    /* ============================================================
       APP SUPPORT & LEGAL — drives the mobile app's Help & Support
       contact cards and Privacy Policy / Terms & Conditions pages, so
       each business can point these at their own details/pages instead
       of the app's hardcoded placeholders.
       ============================================================ */
    supportEmail: { type: String, default: "" },
    supportPhone: { type: String, default: "" }, // e.g. "+91 98765 43210"
    supportWhatsapp: { type: String, default: "" }, // digits only, e.g. "919876543210"
    privacyPolicyUrl: { type: String, default: "" },
    termsConditionsUrl: { type: String, default: "" },

    // Link for the "Get the app" card on the website (Home page + footer
    // "Order & track on the go" prompt) — e.g. Play Store / App Store link.
    // Blank by default; the card just isn't clickable until this is set.
    appDownloadUrl: { type: String, default: "" },

    /* ============================================================
       WEBSITE CONTENT — the actual About Us / Privacy Policy / Terms
       text shown directly on the clientweb pages (/about, /privacy,
       /terms), instead of only linking out via the URLs above. Fully
       admin-editable, blank by default — nothing static/hardcoded.
       ============================================================ */
    websiteAboutContent: { type: String, default: "" },
    websitePrivacyContent: { type: String, default: "" },
    websiteTermsContent: { type: String, default: "" },

    // Short one-line footer/about tagline describing the business — e.g.
    // "A multi-category marketplace & B2B ordering platform — one storefront
    // for retail shoppers and wholesale/manufacturer party accounts alike."
    // Blank by default; clientweb falls back to a generic sentence when empty.
    websiteTagline: { type: String, default: "" },

    // The business's own logo, uploaded from Settings → General. Shown in the
    // website header, footer and login page, and on the app's login screen
    // once a business has been activated there. Blank = each surface falls
    // back to the lettered avatar it drew before, so nothing looks broken for
    // a business that has not uploaded one.
    brandLogo: { type: String, default: "" },

    // The business's primary brand colour, as a #rrggbb hex.
    //
    // One colour, not a palette: the website and the app each build their own
    // full ramp from it (tints, hover states, gradients, the app's tab bar) so
    // an admin picks once and every surface follows. This replaced a table of
    // hand-written palettes keyed by business code, which meant a new business
    // wanting its own colours needed a code change and a deploy.
    //
    // Blank = the built-in green/teal, exactly as before.
    themeBrandColor: { type: String, default: "" },

    /* ============================================================
       PRODUCT IMAGE RATIO — the shape of the picture box on product
       cards. One value per surface, because these grids were never the
       same size: the app's cards are small and square-ish, the website's
       Deal of the Day strip is a narrow carousel tile, and the Shop grid
       is wider again. A single shared ratio would have squashed one of
       them to fit the others.

       The photo itself still fills its box cropped (cover), so a
       catalogue of differently proportioned uploads stays aligned.
       Blank = the fixed height that surface used before this setting
       existed, so nothing moves for a business that never touches it.
       ============================================================ */
    // App — Home and Shop product cards (one value for both; the phone
    // grid is the same two-column card on either screen).
    appProductImageRatio: { ...PRODUCT_IMAGE_RATIO_RULE },
    // Website — Deal of the Day carousel tiles.
    websiteDealProductImageRatio: { ...PRODUCT_IMAGE_RATIO_RULE },
    // Website — Featured Products and New Arrivals on the Home page. Also
    // the fallback for every other card on the site (related products on a
    // product page, the account page's reorder grid).
    websiteHomeProductImageRatio: { ...PRODUCT_IMAGE_RATIO_RULE },
    // Website — the Shop / All Products grid.
    websiteShopProductImageRatio: { ...PRODUCT_IMAGE_RATIO_RULE },

    /**
     * Party app Home shows a catalogue to browse rather than a storefront.
     *
     * Off (default): the shopper Home — hero banner, category circles, a grid
     * of product cards with prices and Add buttons.
     *
     * On: Category tiles → sub-categories → an order sheet listing every
     * product with a quantity box, the way a wholesale counter is worked. Some
     * businesses sell hundreds of near-identical parts (sizes of the same
     * nipple, say) where a picture grid is useless and a typed quantity per
     * line is the whole job.
     */
    appCatalogBrowseMode: { type: Boolean, default: false },

    /* ============================================================
       SOCIAL LINKS — website footer only shows an icon for a network
       once its URL is filled in here. No dummy/placeholder icons.
       ============================================================ */
    socialFacebookUrl: { type: String, default: "" },
    socialInstagramUrl: { type: String, default: "" },
    socialTwitterUrl: { type: String, default: "" },
    socialLinkedinUrl: { type: String, default: "" },

    /* ============================================================
       HOME PAGE PRODUCT SELECTIONS — Featured Products, New Arrivals
       and Deal of the Day are each independently admin-curated
       (product + optional unit/variant pick list), same idea as a
       normal ecommerce admin panel. Any list left empty falls back to
       a sensible catalog-driven default so the section is never blank.
       ============================================================ */
    featuredProductItems: {
      type: [
        {
          _id: false,
          productid: { type: mongoose.Schema.Types.ObjectId, ref: "ProductService", required: true },
          unitid: { type: mongoose.Schema.Types.ObjectId, ref: "Unit", default: null },
        },
      ],
      default: [],
    },
    newArrivalItems: {
      type: [
        {
          _id: false,
          productid: { type: mongoose.Schema.Types.ObjectId, ref: "ProductService", required: true },
          unitid: { type: mongoose.Schema.Types.ObjectId, ref: "Unit", default: null },
        },
      ],
      default: [],
    },
    dealOfDayEnabled: { type: Boolean, default: true },
    dealOfDayTitle: { type: String, default: "" },
    dealOfDaySubtitle: { type: String, default: "" },
    dealOfDayItems: {
      type: [
        {
          _id: false,
          productid: { type: mongoose.Schema.Types.ObjectId, ref: "ProductService", required: true },
          // Which unit/variant (Piece, Dozen, ...) to feature for this
          // product — optional; blank = product's default/first unit.
          unitid: { type: mongoose.Schema.Types.ObjectId, ref: "Unit", default: null },
        },
      ],
      default: [],
    },

    /* ============================================================
       HERO BANNER — admin-managed list of Home page carousel slides
       (image + copy, add/edit/remove any number of them). Empty list
       keeps the automatic catalog-driven slides instead.
       ============================================================ */
    // The two category tiles beside the Home page hero. Off means the hero
    // takes the full width instead — some businesses run one wide banner and
    // do not want their catalogue advertised next to it. Default true, so
    // nothing changes for anyone who never touches the switch.
    heroBannerShowCategoryTiles: { type: Boolean, default: true },

    heroBannerSlides: {
      type: [
        {
          _id: false,
          image: { type: String, default: "" },
          title: { type: String, default: "" },
          subtitle: { type: String, default: "" },
          cta: { type: String, default: "" },
          link: { type: String, default: "" },
        },
      ],
      default: [],
    },

    // Promo tiles shown between Featured Products and New Arrivals on the
    // Home page (same shape as hero banner slides) — add/edit/remove any
    // number; empty list keeps the built-in default two tiles.
    promoBanners: {
      type: [
        {
          _id: false,
          image: { type: String, default: "" },
          title: { type: String, default: "" },
          subtitle: { type: String, default: "" },
          cta: { type: String, default: "" },
          link: { type: String, default: "" },
        },
      ],
      default: [],
    },

    // "Trust bar" stat tiles on the Home page (e.g. "12,400+ / Active retail
    // partners") — admin-managed, add/edit/remove any number; empty list
    // keeps clientweb's built-in placeholder stats instead.
    businessStats: {
      type: [
        {
          _id: false,
          label: { type: String, default: "" },
          value: { type: String, default: "" },
        },
      ],
      default: [],
    },
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
