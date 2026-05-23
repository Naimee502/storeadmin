import { gql } from 'apollo-server-express';

export const transferStockTypeDefs = gql`
  type Admin {
    id: ID!
    name: String!
    email: String!
    subscriptionType: String
    subscribed: Boolean
    subscribedAt: String
    subscriptionEnd: String
    transactionId: String
    needsReview: Boolean!
    rejected: Boolean!
  }

  # One item line in a transfer voucher
  type TransferStockItem {
    productid: ID!
    variantid: ID
    transferunitid: ID
    transferqty: Float!
    rate: Float
    amount: Float
  }

  input TransferStockItemInput {
    productid: ID!
    variantid: ID
    transferunitid: ID
    transferqty: Float!
    rate: Float
    amount: Float
  }

  # Transfer Stock Voucher (Tally-style: one voucher, multiple items)
  type TransferStock {
    id: ID!
    vouchernumber: String
    frombranchid: String!
    tobranchid: String!
    transferdate: String!
    narration: String
    items: [TransferStockItem!]!
    totalamount: Float
    status: Boolean!
    admin: Admin
    createdby_id: ID
    createdby_name: String
    createdby_type: String
  }

  input TransferStockInput {
    frombranchid: ID!
    tobranchid: ID!
    transferdate: String!
    narration: String
    items: [TransferStockItemInput!]!
    totalamount: Float
    status: Boolean
    admin: ID
    createdby_id: ID
    createdby_name: String
    createdby_type: String
  }

  type Query {
    getTransferStocks(adminId: ID, frombranchid: ID): [TransferStock!]!
    getDeletedTransferStocks(adminId: ID, frombranchid: ID): [TransferStock!]!
    getTransferStockById(id: ID!, adminId: ID): TransferStock
  }

  type Mutation {
    addTransferStock(input: TransferStockInput!): TransferStock!
    editTransferStock(id: ID!, input: TransferStockInput!): TransferStock!
    deleteTransferStock(id: ID!): Boolean!
    resetTransferStock(id: ID!): Boolean!
  }
`;
