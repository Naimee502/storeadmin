import { gql } from 'apollo-server-express';

export const transferStockTypeDefs = gql`
  type TransferStock {
    id: ID!
    frombranchid: String!
    tobranchid: String!
    productid: String!
    transferqty: Int!
    transferdate: String!
    status: Boolean!
  }

  input TransferStockInput {
    frombranchid: ID!
    tobranchid: ID!
    productid: ID!
    transferqty: Int!
    transferdate: String!
    status: Boolean!
  }

  type Query {
    getTransferStocks: [TransferStock!]!
    getDeletedTransferStocks: [TransferStock!]!
    getTransferStockById(id: ID!): TransferStock
  }

  type Mutation {
    addTransferStock(input: TransferStockInput!): TransferStock!
    editTransferStock(id: ID!, input: TransferStockInput!): TransferStock!
    deleteTransferStock(id: ID!): Boolean!
    resetTransferStock(id: ID!): Boolean!
  }
`;
