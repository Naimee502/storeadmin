import { gql } from "apollo-server-express";
// (bill allocation + journal preview)

export const transactionTypeDefs = gql`
  type LedgerRef {
    id: ID!
    ledgername: String!
  }

  # Entry Line Item
  type TransactionEntry {
    ledgerid: LedgerRef
    debit: Float
    credit: Float
    productserviceid: ID
    variantid: ID
    remarks: String
  }

  input TransactionEntryInput {
    ledgerid: ID
    debit: Float
    credit: Float
    productserviceid: ID
    variantid: ID
    remarks: String
  }

  type TransactionSource {
    docmodel: String
    docid: ID
  }

  input TransactionSourceInput {
    docmodel: String
    docid: ID
  }

  type TxnInvoiceAlloc {
    invoiceid: ID
    invoicemodel: String
    settledamount: Float
  }

  input TxnInvoiceAllocInput {
    invoiceid: ID
    invoicemodel: String
    settledamount: Float
  }

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
    partyid: ID
    invoices: [TxnInvoiceAlloc]
    createdby_id: ID
    createdby_name: String
    createdby_type: String
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
    partyid: ID
    invoices: [TxnInvoiceAllocInput]
    createdby_id: ID
    createdby_name: String
    createdby_type: String
    updatedby: ID
    status: Boolean
  }

  input TransactionFilterInput {
    adminid: ID
    branchid: ID
    ledgerid: ID
    partyid: ID
    entrytype: String
    transactioncode: String
    dateFrom: String
    dateTo: String
    status: Boolean
  }

  type JournalPreviewLine {
    ledgerid: ID
    ledgername: String
    debit: Float
    credit: Float
    remarks: String
  }

  type Query {
    getTransactions(filter: TransactionFilterInput): [Transaction!]!
    getDeletedTransactions(filter: TransactionFilterInput): [Transaction!]!
    getTransactionById(id: ID!, adminid: ID): Transaction
    previewInvoiceJournal(invoiceid: ID!, invoicemodel: String!): [JournalPreviewLine!]!
  }

  type Mutation {
    addTransaction(input: TransactionInput!): Transaction!
    editTransaction(id: ID!, input: TransactionInput!): Transaction!
    deleteTransaction(id: ID!): Boolean!
    resetTransaction(id: ID!): Boolean!
  }
`;
