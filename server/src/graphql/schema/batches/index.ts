import { gql } from "apollo-server-express";

export const batchTypeDefs = gql`
  extend type SalesInvoiceProductService { batchno: String expirydate: String batchauto: Boolean }
  extend input SalesInvoiceProductServiceInput { batchno: String expirydate: String batchauto: Boolean }
  extend type PurchaseInvoiceProductService { batchno: String expirydate: String mfgdate: String }
  extend input PurchaseInvoiceProductServiceInput { batchno: String expirydate: String mfgdate: String }
  extend type SalesReturnProductService { batchno: String expirydate: String }
  extend input SalesReturnProductServiceInput { batchno: String expirydate: String }
  extend type PurchaseReturnProductService { batchno: String expirydate: String batchauto: Boolean }
  extend input PurchaseReturnProductServiceInput { batchno: String expirydate: String batchauto: Boolean }

  type BatchRow {
    id: ID!
    branchid: ID!
    branchname: String
    productid: ID!
    productname: String
    variantid: ID
    variantname: String
    batchno: String!
    "YYYY-MM-DD"
    expirydate: String
    mfgdate: String
    "In base units."
    qty: Float!
    "Days to expiry; negative when expired."
    daysleft: Int
  }

  type UnbatchedRow {
    branchid: ID!
    branchname: String
    productid: ID!
    productname: String
    variantid: ID
    variantname: String
    stock: Float!
    inbatches: Float!
    unbatched: Float!
  }

  input BatchFilter {
    branchid: ID
    productid: ID
    search: String
    "Only batches expiring within these many days (expired included)."
    expiringdays: Int
    expired: Boolean
    "Include batches with no stock left."
    includeempty: Boolean
  }

  input OpeningBatchInput {
    branchid: ID!
    productid: ID!
    variantid: ID
    batchno: String!
    expirydate: String
    mfgdate: String
    qty: Float!
  }

  extend type Query {
    getBatches(filter: BatchFilter): [BatchRow!]!
    "Batches of an item at a branch for a bill line, earliest expiry first (in-date with stock)."
    getProductBatches(productid: ID!, variantid: ID, branchid: ID!): [BatchRow!]!
    "Item stock not yet put into batches (stock on hand before batches were used)."
    getUnbatchedStock(branchid: ID): [UnbatchedRow!]!
  }

  extend type Mutation {
    "Put stock already on hand into a batch (item stock does not change)."
    addOpeningBatch(input: OpeningBatchInput!): BatchRow!
    "Correct a batch's expiry or manufacturing date."
    editBatch(id: ID!, expirydate: String, mfgdate: String): BatchRow!
  }
`;
