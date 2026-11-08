import { gql } from "apollo-server-express";

export const stockAdjustmentTypeDefs = gql`
  type StockAdjustmentItem {
    productid: ProductService
    variantid: ID
    quantity: Float!
    rate: Float!
    amount: Float!
  }

  type StockAdjustmentAdminRef {
    id: ID
    name: String
  }

  type StockAdjustmentBranchRef {
    id: ID
    branchname: String
  }

  type StockAdjustment {
    id: ID!
    adminid: StockAdjustmentAdminRef
    branchid: StockAdjustmentBranchRef
    vouchernumber: String
    adjustmentdate: Date
    type: String
    reason: String
    items: [StockAdjustmentItem]
    totalamount: Float
    createdby_id: ID
    createdby_name: String
    createdby_type: String
    status: Boolean
    createdAt: Date
    updatedAt: Date
    offlineNumber: String
  }

  type StockAdjustmentPage {
    items: [StockAdjustment]!
    total: Int!
  }

  input StockAdjustmentItemInput {
    productid: ID!
    variantid: ID
    quantity: Float!
    rate: Float!
    amount: Float!
  }

  input StockAdjustmentInput {
    adminid: ID
    branchid: ID
    adjustmentdate: Date
    type: String!
    reason: String
    items: [StockAdjustmentItemInput]!
    totalamount: Float!
    createdby_id: ID
    createdby_name: String
    createdby_type: String
    status: Boolean
    "Offline device number (SA-A/000012) only; the main series numbers the voucher."
    vouchernumber: String
    "Set by offline sync so a retried save returns the same document."
    clientRequestId: String
  }

  input StockAdjustmentFilterInput {
    adminid: ID
    branchid: ID
    type: String
    vouchernumber: String
    createdFrom: String
    createdTo: String
    status: Boolean
  }

  extend type Query {
    getStockAdjustments(filter: StockAdjustmentFilterInput, limit: Int, offset: Int): [StockAdjustment]
    getStockAdjustmentsPage(filter: StockAdjustmentFilterInput, page: Int, pageSize: Int, search: String, columnFilters: [ColumnFilter!]): StockAdjustmentPage!
    getStockAdjustmentById(id: ID!, adminId: ID, branchId: ID): StockAdjustment
  }

  input StockAdjustmentUpdateInput {
    adjustmentdate: Date
    type: String
    reason: String
    items: [StockAdjustmentItemInput]!
    totalamount: Float!
    createdby_id: ID
    createdby_name: String
    createdby_type: String
  }

  extend type Mutation {
    createStockAdjustment(input: StockAdjustmentInput!): StockAdjustment
    "expectedUpdatedAt: optional; when it differs from the stored updatedAt the edit fails with CONFLICT."
    updateStockAdjustment(id: ID!, input: StockAdjustmentUpdateInput!, expectedUpdatedAt: String): StockAdjustment
    deleteStockAdjustment(id: ID!, expectedUpdatedAt: String): Boolean
    cancelStockAdjustment(id: ID!, expectedUpdatedAt: String): Boolean
    resetStockAdjustment(id: ID!): Boolean
  }
`;
