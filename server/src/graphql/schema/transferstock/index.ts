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
  }

  type TransferStock {
    id: ID!
    frombranchid: String!
    tobranchid: String!
    productid: String!
    transferqty: Int!
    transferdate: String!
    status: Boolean!
    admin: Admin
  }

  input TransferStockInput {
    frombranchid: ID!
    tobranchid: ID!
    productid: ID!
    transferqty: Int!
    transferdate: String!
    status: Boolean!
    admin: ID
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
