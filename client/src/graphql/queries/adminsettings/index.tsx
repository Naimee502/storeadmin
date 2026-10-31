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
  printShowHsnColumn
  printShowGstColumn
  printShowTotalGst
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
  loginEmailOtp
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

// Test mail through the business's saved SMTP mailbox (Business Settings ->
// Email (SMTP)). Resolves to a success message; fails with the SMTP error.
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
