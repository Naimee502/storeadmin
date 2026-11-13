import { gql } from "apollo-server-express";

export const stockMoveTypeDefs = gql`
  type StockMoveRow {
    id: ID!
    productid: ID
    productname: String
    variantid: ID
    branchid: ID
    qty: Float
    balance: Float
    doctype: String
    docid: ID
    docno: String
    date: String
    note: String
    createdAt: String
  }

  type StockMovePage {
    rows: [StockMoveRow!]!
    total: Int!
  }

  extend type Query {
    "Stock ledger: every movement of an item (newest first). Blank product = every item."
    getStockMoves(productid: ID, variantid: ID, branchid: ID, doctype: String, from: String, to: String, limit: Int, offset: Int): StockMovePage!
  }
`;
