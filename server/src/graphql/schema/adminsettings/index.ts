import { gql } from "apollo-server-express";

export const adminSettingsTypeDefs = gql`
  type HeroBannerSlide {
    image: String
    title: String
    subtitle: String
    cta: String
    link: String
  }

  input HeroBannerSlideInput {
    image: String
    title: String
    subtitle: String
    cta: String
    link: String
  }

  # "Trust bar" stat tile — e.g. { label: "Active retail partners", value: "12,400+" }.
  type BusinessStat {
    label: String
    value: String
  }

  input BusinessStatInput {
    label: String
    value: String
  }

  # A single product+variant pick — used independently by Featured
  # Products, New Arrivals and Deal of the Day, so each Home page
  # section can have its own curated list.
  type ProductPickItem {
    productid: ID!
    unitid: ID
  }

  input ProductPickItemInput {
    productid: ID!
    unitid: ID
  }

  type AdminSettings {
    id: ID!
    adminid: ID!

    autoCreateLedgerOnSalesInvoice: Boolean!
    autoCreatePaymentOnSalesInvoice: Boolean!
    autoCreateStockOnSalesInvoice: Boolean!
    autoCreateLedgerOnPurchaseInvoice: Boolean!
    autoCreatePaymentOnPurchaseInvoice: Boolean!
    autoCreateStockOnPurchaseInvoice: Boolean!
    autoCreateLedgerOnExpense: Boolean!
    autoCreatePaymentOnExpense: Boolean!
    autoCreateLedgerOnSalesReturn: Boolean!
    autoCreateLedgerOnPurchaseReturn: Boolean!

    allowNegativeStock: Boolean!
    preventDuplicateInvoiceNumbers: Boolean!

    defaultGstPercent: Float!
    defaultPaymentType: String!
    defaultTaxOrSupplyType: String!
    defaultBillType: String!

    salesInvoicePrefix: String!
    purchaseInvoicePrefix: String!
    salesReturnPrefix: String!
    purchaseReturnPrefix: String!
    salesOrderPrefix: String!
    purchaseOrderPrefix: String!
    expenseNotePrefix: String!

    enableGst: Boolean!
    displayProductPriceOnWebsite: Boolean!
    displayStockOnWebsite: Boolean!
    encryptInvoicePrices: Boolean!
    deliveryMode: String
    partyManagesDownline: Boolean
    enablePaymentDiscountCommission: Boolean
    paymentAutoSettlement: String
    paymentAllocationOrder: String
    autoAdjustAdvanceOnInvoice: Boolean
    allowAdminToManageBusinessSettings: Boolean!
    allowAdminToManageModules: Boolean!
    allowAdminToManagePermissions: Boolean!

    # Screen-capture protection. See the model for what each one can
    # actually enforce per platform — "on" does NOT mean the same thing
    # on Android (OS-enforced black screen) as in a browser tab
    # (watermark only; browsers expose no capture-detection API).
    secureScreenApp: Boolean
    secureScreenAdmin: Boolean
    secureScreenWebsite: Boolean

    printShowCompanyHeader: Boolean
    printShowCompanyNameInSignature: Boolean
    printShowTermsAndConditions: Boolean
    printTermsAndConditions: String
    printShowPartyBalance: Boolean
    printShowEwayBillDistance: Boolean
    printShowDeliveryDueDate: Boolean
    printShowGstin: Boolean
    printShowHsnColumn: Boolean
    printShowGstColumn: Boolean
    printShowTotalGst: Boolean

    supportEmail: String
    supportPhone: String
    supportWhatsapp: String
    privacyPolicyUrl: String
    termsConditionsUrl: String

    # "Get the app" link on the website (Home page + footer prompt).
    appDownloadUrl: String

    # Website storefront — whether checkout offers online payments or
    # Cash on Delivery only, and this admin's public website link.
    websiteCodOnly: Boolean
    storeslug: String

    # Website content (rich HTML) shown directly on the clientweb
    # About/Privacy/Terms pages.
    websiteAboutContent: String
    websitePrivacyContent: String
    websiteTermsContent: String

    # Short one-line footer/about tagline describing the business.
    websiteTagline: String

    # Uploaded business logo. Blank = the surface draws its lettered avatar.
    brandLogo: String

    # Primary brand colour (#rrggbb). The website and app each build their own
    # full palette from it. Blank = the built-in green/teal.
    themeBrandColor: String

    # Social links — footer only shows an icon once a URL is set here.
    socialFacebookUrl: String
    socialInstagramUrl: String
    socialTwitterUrl: String
    socialLinkedinUrl: String

    # Home page product selections — each section independently curated.
    featuredProductItems: [ProductPickItem!]
    newArrivalItems: [ProductPickItem!]

    # Deal of the Day (Home page) — enable/disable, header copy, and the
    # admin's explicit product+variant pick list.
    dealOfDayEnabled: Boolean
    dealOfDayTitle: String
    dealOfDaySubtitle: String
    dealOfDayItems: [ProductPickItem!]

    # Hero banner — admin-managed list of Home page carousel slides.
    heroBannerShowCategoryTiles: Boolean
    heroBannerSlides: [HeroBannerSlide!]

    # Promo tiles between Featured Products and New Arrivals.
    promoBanners: [HeroBannerSlide!]

    # Home page "trust bar" stat tiles.
    businessStats: [BusinessStat!]

    createdAt: String
    updatedAt: String
  }

  # Minimal, public-safe shape returned to an anonymous website visitor when
  # resolving which admin a storefront link (yourdomain.com/<storeslug>)
  # belongs to. Deliberately doesn't reuse the full AdminSettings/Admin
  # types — clientweb only ever needs these fields to boot the site.
  type StorefrontInfo {
    adminid: ID!
    branchid: ID
    companyName: String!
    address: String
    codOnly: Boolean!
    displayProductPriceOnWebsite: Boolean!
    displayStockOnWebsite: Boolean!

    # Whether the storefront should render the tiled watermark. Safe to
    # expose publicly — it reveals nothing about the business, and the
    # visitor's browser has to know in order to draw it.
    secureScreenWebsite: Boolean

    supportEmail: String
    supportPhone: String
    supportWhatsapp: String
    appDownloadUrl: String

    websiteAboutContent: String
    websitePrivacyContent: String
    websiteTermsContent: String
    websiteTagline: String
    brandLogo: String
    themeBrandColor: String

    socialFacebookUrl: String
    socialInstagramUrl: String
    socialTwitterUrl: String
    socialLinkedinUrl: String

    featuredProductItems: [ProductPickItem!]
    newArrivalItems: [ProductPickItem!]

    dealOfDayEnabled: Boolean
    dealOfDayTitle: String
    dealOfDaySubtitle: String
    dealOfDayItems: [ProductPickItem!]

    heroBannerShowCategoryTiles: Boolean
    heroBannerSlides: [HeroBannerSlide!]
    promoBanners: [HeroBannerSlide!]

    businessStats: [BusinessStat!]
  }

  # Partial input — only sends fields that changed. Server merges over the
  # existing document so toggling one switch doesn't reset the rest.
  input AdminSettingsInput {
    autoCreateLedgerOnSalesInvoice: Boolean
    autoCreatePaymentOnSalesInvoice: Boolean
    autoCreateStockOnSalesInvoice: Boolean
    autoCreateLedgerOnPurchaseInvoice: Boolean
    autoCreatePaymentOnPurchaseInvoice: Boolean
    autoCreateStockOnPurchaseInvoice: Boolean
    autoCreateLedgerOnExpense: Boolean
    autoCreatePaymentOnExpense: Boolean
    autoCreateLedgerOnSalesReturn: Boolean
    autoCreateLedgerOnPurchaseReturn: Boolean

    allowNegativeStock: Boolean
    preventDuplicateInvoiceNumbers: Boolean

    defaultGstPercent: Float
    defaultPaymentType: String
    defaultTaxOrSupplyType: String
    defaultBillType: String

    salesInvoicePrefix: String
    purchaseInvoicePrefix: String
    salesReturnPrefix: String
    purchaseReturnPrefix: String
    salesOrderPrefix: String
    purchaseOrderPrefix: String
    expenseNotePrefix: String

    enableGst: Boolean
    displayProductPriceOnWebsite: Boolean
    displayStockOnWebsite: Boolean
    encryptInvoicePrices: Boolean
    deliveryMode: String
    partyManagesDownline: Boolean
    enablePaymentDiscountCommission: Boolean
    paymentAutoSettlement: String
    paymentAllocationOrder: String
    autoAdjustAdvanceOnInvoice: Boolean
    allowAdminToManageBusinessSettings: Boolean
    allowAdminToManageModules: Boolean
    allowAdminToManagePermissions: Boolean

    secureScreenApp: Boolean
    secureScreenAdmin: Boolean
    secureScreenWebsite: Boolean

    printShowCompanyHeader: Boolean
    printShowCompanyNameInSignature: Boolean
    printShowTermsAndConditions: Boolean
    printTermsAndConditions: String
    printShowPartyBalance: Boolean
    printShowEwayBillDistance: Boolean
    printShowDeliveryDueDate: Boolean
    printShowGstin: Boolean
    printShowHsnColumn: Boolean
    printShowGstColumn: Boolean
    printShowTotalGst: Boolean

    supportEmail: String
    supportPhone: String
    supportWhatsapp: String
    privacyPolicyUrl: String
    termsConditionsUrl: String
    appDownloadUrl: String

    websiteCodOnly: Boolean
    storeslug: String

    websiteAboutContent: String
    websitePrivacyContent: String
    websiteTermsContent: String
    websiteTagline: String
    brandLogo: String
    themeBrandColor: String

    socialFacebookUrl: String
    socialInstagramUrl: String
    socialTwitterUrl: String
    socialLinkedinUrl: String

    featuredProductItems: [ProductPickItemInput!]
    newArrivalItems: [ProductPickItemInput!]

    dealOfDayEnabled: Boolean
    dealOfDayTitle: String
    dealOfDaySubtitle: String
    dealOfDayItems: [ProductPickItemInput!]

    heroBannerShowCategoryTiles: Boolean
    heroBannerSlides: [HeroBannerSlideInput!]
    promoBanners: [HeroBannerSlideInput!]

    businessStats: [BusinessStatInput!]
  }

  extend type Query {
    getAdminSettings(adminid: ID!): AdminSettings!
    getStorefrontByStoreSlug(storeslug: String!): StorefrontInfo
  }

  extend type Mutation {
    updateAdminSettings(adminid: ID!, input: AdminSettingsInput!): AdminSettings!
  }
`;
