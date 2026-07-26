import { gql } from "@apollo/client";

const SETTINGS_FIELDS = `
  id
  adminid
  autoCreateLedgerOnSalesInvoice
  autoCreatePaymentOnSalesInvoice
  autoCreateStockOnSalesInvoice
  autoCreateLedgerOnPurchaseInvoice
  autoCreatePaymentOnPurchaseInvoice
  autoCreateStockOnPurchaseInvoice
  autoCreateLedgerOnExpense
  autoCreatePaymentOnExpense
  autoCreateLedgerOnSalesReturn
  autoCreateLedgerOnPurchaseReturn
  allowNegativeStock
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
  deliveryMode
  partyManagesDownline
  enablePaymentDiscountCommission
  allowAdminToManageBusinessSettings
  allowAdminToManageModules
  allowAdminToManagePermissions
  printShowCompanyHeader
  printShowCompanyNameInSignature
  printShowTermsAndConditions
  printTermsAndConditions
  printShowPartyBalance
  supportEmail
  supportPhone
  supportWhatsapp
  privacyPolicyUrl
  termsConditionsUrl
  appDownloadUrl
  websiteCodOnly
  storeslug
  websiteAboutContent
  websitePrivacyContent
  websiteTermsContent
  websiteTagline
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
  heroBannerSlides {
    image
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
