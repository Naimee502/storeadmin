import { gql } from "apollo-server-express";

export const adminSettingsTypeDefs = gql`
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
    encryptInvoicePrices: Boolean!
    allowAdminToManageBusinessSettings: Boolean!
    allowAdminToManageModules: Boolean!
    allowAdminToManagePermissions: Boolean!

    createdAt: String
    updatedAt: String
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
    encryptInvoicePrices: Boolean
    allowAdminToManageBusinessSettings: Boolean
    allowAdminToManageModules: Boolean
    allowAdminToManagePermissions: Boolean
  }

  extend type Query {
    getAdminSettings(adminid: ID!): AdminSettings!
  }

  extend type Mutation {
    updateAdminSettings(adminid: ID!, input: AdminSettingsInput!): AdminSettings!
  }
`;
