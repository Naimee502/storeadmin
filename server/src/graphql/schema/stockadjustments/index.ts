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
    updateStockAdjustment(id: ID!, input: StockAdjustmentUpdateInput!): StockAdjustment
    deleteStockAdjustment(id: ID!): Boolean
    cancelStockAdjustment(id: ID!): Boolean
    resetStockAdjustment(id: ID!): Boolean
  }
`;
