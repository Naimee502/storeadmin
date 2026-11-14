import { gql } from "@apollo/client";

const SETTINGS_FIELDS = `
  id
  adminid
  autoCreateStockOnSalesInvoice
  autoCreateStockOnPurchaseInvoice
  autoCreateStockOnSalesReturn
  autoCreateStockOnPurchaseReturn
  allowNegativeStock
  restrictQuantityByStock
  preventDuplicateInvoiceNumbers
  defaultGstPercent
  defaultPaymentType
  defaultTaxOrSupplyType
  defaultBillType
  salesInvoicePrefix
  purchaseInvoicePrefix
  salesReturnPrefix
  purchaseReturnPrefix
  salesOrderPrefix
  purchaseOrderPrefix
  expenseNotePrefix
  enableGst
  displayProductPriceOnWebsite
  displayStockOnWebsite
  encryptInvoicePrices
  doubleDisplayPrice
  deliveryMode
  partyManagesDownline
  offlineBilling
  directPartyOrdersOnly
  trackPartyStock
  requirePartyApproval
  enablePaymentDiscountCommission
  showLastPaymentOnStatement
  deleteInvoiceFromInsideOnly
  paymentAutoSettlement
  paymentAllocationOrder
  autoAdjustAdvanceOnInvoice
  allowAdminToManageBusinessSettings
  allowAdminToManageModules
  allowAdminToManagePermissions
  secureScreenApp
  secureScreenAdmin
  secureScreenWebsite
  printShowCompanyHeader
  printShowCompanyNameInSignature
  printShowTermsAndConditions
  printTermsAndConditions
  printShowPartyBalance
  printShowEwayBillDistance
  printShowDeliveryDueDate
  printShowGstin
  gstin
  legalName
  tradeName
  gstAddress
  gstCity
  gstPincode
  gstStateSplit
  crmStages { key label kind }
  crmSources
  crmLostReasons
  productSpecsOn
  productExtrasOn
  customFieldDefs { key label entity type options print required }
  aiEnabled aiModel aiMonthlyCap aiAgentOn aiApiKeySet
  companyState
  printShowHsnColumn
  printShowGstColumn
  printShowTotalGst
  printShowTaxSplit
  supportEmail
  supportPhone
  supportWhatsapp
  privacyPolicyUrl
  termsConditionsUrl
  appDownloadUrl
  websiteCodOnly
  websitePaymentMode
  storeslug
  customDomain
  smtpHost
  smtpPort
  smtpUser
  smtpPassSet
  websiteAboutContent
  websitePrivacyContent
  websiteTermsContent
  websiteTagline
  brandLogo
  themeBrandColor
  appProductImageRatio
  websiteDealProductImageRatio
  websiteHomeProductImageRatio
  websiteShopProductImageRatio
  websiteShopInfiniteScroll
  appCatalogBrowseMode
  appCategoryAutoScroll
  appProductAutoScroll
  showPartyLiveLocation
  loginEmailOtp
  loginTabs
  onlineBookingAllowed
  bookingOn
  bookingFrom
  bookingTo
  bookingStepMinutes
  bookingDaysAhead
  loyaltyEarnPer100
  loyaltyPointValue
  loyaltyMinBill
  loyaltyMaxEarn
  loyaltyExpiryDays
  loyaltyMinRedeem
  loyaltyMaxRedeemPercent
  ownerDoctor { name specialization qualification regno experience fee about photo online }
  geoFenceEnabled
  geoFenceRadiusM
  salesmanLeaderboardEnabled
  attendanceSelfieRequired
  salesmanOrderDiscountEnabled
  salesmanPriceListDiscount
  partyLoginEmailOtp
  autoPunchOutEnabled
  autoPunchOutTime
  socialFacebookUrl
  socialInstagramUrl
  socialTwitterUrl
  socialLinkedinUrl
  featuredProductItems {
    productid
    unitid
  }
  newArrivalItems {
    productid
    unitid
  }
  dealOfDayEnabled
  dealOfDayTitle
  dealOfDaySubtitle
  dealOfDayItems {
    productid
    unitid
  }
  heroBannerShowCategoryTiles
  heroBannerShowCategoryTiles
  heroBannerSlides {
    image
    video
    title
    subtitle
    cta
    link
  }
  promoBanners {
    image
    title
    subtitle
    cta
    link
  }
  businessStats {
    label
    value
  }
  websiteShowTrustBar
  websiteShowPromoBanners
  websiteShowAppSection
  allowProductImageDownload
  showWhatsappChat
`;

// Top-level fields the page reads; a save sends only these (an offline copy can carry more).
const SETTINGS_KEYS = (() => {
  const keys = new Set<string>();
  let depth = 0;
  for (const tok of SETTINGS_FIELDS.replace(/#.*$/gm, "").match(/[A-Za-z_]\w*|[{}]/g) || []) {
    if (tok === "{") depth += 1;
    else if (tok === "}") depth -= 1;
    else if (depth === 0) keys.add(tok);
  }
  // Read-only flags; the key and password themselves go back as aiApiKey / smtpPass.
  for (const k of ["id", "adminid", "aiApiKeySet", "smtpPassSet"]) keys.delete(k);
  for (const k of ["aiApiKey", "smtpPass"]) keys.add(k);
  return keys;
})();

/** Keeps only the fields the settings input accepts. */
export const pickSettingsInput = (draft: Record<string, any>) =>
  Object.fromEntries(Object.entries(draft || {}).filter(([k]) => SETTINGS_KEYS.has(k)));


export const GET_ADMIN_SETTINGS = gql`
  query GetAdminSettings($adminid: ID!) {
    getAdminSettings(adminid: $adminid) {
      ${SETTINGS_FIELDS}
    }
  }
`;

export const UPDATE_ADMIN_SETTINGS = gql`
  mutation UpdateAdminSettings($adminid: ID!, $input: AdminSettingsInput!) {
    updateAdminSettings(adminid: $adminid, input: $input) {
      ${SETTINGS_FIELDS}
    }
  }
`;

// Send a test mail through the saved SMTP mailbox.
export const TEST_BUSINESS_SMTP = gql`
  mutation TestBusinessSmtp($adminid: ID!, $to: String!) {
    testBusinessSmtp(adminid: $adminid, to: $to)
  }
`;

export const GET_PERMISSIONS = gql`
  query GetPermissions($scope: PermissionScope!, $scopeid: ID!) {
    getPermissions(scope: $scope, scopeid: $scopeid) {
      scope
      scopeid
      permissions
    }
  }
`;

export const GET_EFFECTIVE_PERMISSIONS = gql`
  query GetEffectivePermissions($scope: PermissionScope!, $scopeid: ID!) {
    getEffectivePermissions(scope: $scope, scopeid: $scopeid) {
      scope
      scopeid
      permissions
    }
  }
`;

export const SET_PERMISSIONS = gql`
  mutation SetPermissions(
    $scope: PermissionScope!
    $scopeid: ID!
    $permissions: JSON!
  ) {
    setPermissions(scope: $scope, scopeid: $scopeid, permissions: $permissions) {
      scope
      scopeid
      permissions
    }
  }
`;
