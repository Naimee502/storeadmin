import { gql } from "apollo-server-express";

export const transactionTypeDefs = gql`
  type LedgerRef {
    id: ID!
    ledgername: String!
  }

  # Entry Line Item
  type TransactionEntry {
    ledgerid: LedgerRef!      
    debit: Float
    credit: Float
    productserviceid: ID
    variantid: ID
    remarks: String
  }

  input TransactionEntryInput {
    ledgerid: ID!            
    debit: Float
    credit: Float
    productserviceid: ID
    variantid: ID
    remarks: String
  }

  # Source document info
  type TransactionSource {
    docmodel: String
    docid: ID
  }

  input TransactionSourceInput {
    docmodel: String
    docid: ID
  }

  # Transaction Main
  type Transaction {
    id: ID!
    adminid: ID!
    branchid: ID!
    transactioncode: String
    entrytype: String!
    source: TransactionSource
    transactiondate: String
    narration: String
    entries: [TransactionEntry!]!
    totaldebit: Float!
    totalcredit: Float!
    createdby: ID
    updatedby: ID
    status: Boolean!
    createdAt: String
    updatedAt: String
  }

  input TransactionInput {
    adminid: ID!
    branchid: ID!
    entrytype: String
    source: TransactionSourceInput
    transactiondate: String
    narration: String
    entries: [TransactionEntryInput!]!
    createdby: ID
    updatedby: ID
    status: Boolean
  }

  input TransactionFilterInput {
    adminid: ID
    branchid: ID
    entrytype: String
    transactioncode: String
    dateFrom: String
    dateTo: String
    status: Boolean
  }

  # Queries
  type Query {
    getTransactions(filter: TransactionFilterInput): [Transaction!]!
    getDeletedTransactions(filter: TransactionFilterInput): [Transaction!]!
    getTransactionById(id: ID!, adminid: ID): Transaction
  }

  # Mutations
  type Mutation {
    addTransaction(input: TransactionInput!): Transaction!
    editTransaction(id: ID!, input: TransactionInput!): Transaction!
    deleteTransaction(id: ID!): Boolean!
    resetTransaction(id: ID!): Boolean!
  }
`;
