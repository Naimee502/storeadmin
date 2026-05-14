import { gql } from "@apollo/client";

const SETTINGS_FIELDS = `
  id
  adminid
  autoCreateLedgerOnSalesInvoice
  autoCreateStockOnSalesInvoice
  autoCreateLedgerOnPurchaseInvoice
  autoCreateStockOnPurchaseInvoice
  autoCreateLedgerOnExpense
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
  encryptInvoicePrices
  allowAdminToManageBusinessSettings
  allowAdminToManageModules
  allowAdminToManagePermissions
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
