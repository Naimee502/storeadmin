import { gql } from "apollo-server-express";

export const paymentTypeDefs = gql`
  # Payment Invoice Settlement Line
  type PaymentInvoice {
    invoiceid: ID!
    invoicemodel: String!
    settledamount: Float!
    discount: Float
    commission: Float
  }

  input PaymentInvoiceInput {
    invoiceid: ID!
    invoicemodel: String!
    settledamount: Float!
    discount: Float
    commission: Float
  }

  # Account Type
  type Account {
    id: ID!
    name: String!
  }

  # Ledger Type
  type AccountLedger {
    id: ID!
    ledgername: String!
  }

  # Payment Main
  type Payment {
    id: ID!
    adminid: ID!
    branchid: ID!
    paymentcode: String
    paymentdate: String
    type: String!
    mode: String!
    partyid: Account           # optional
    ledgerid: AccountLedger!   # required
    invoices: [PaymentInvoice!]
    amount: Float!
    reference: String
    remarks: String
    transactionid: ID
    createdby_id: ID
    createdby_name: String
    createdby_type: String
    orderedby_id: ID
    orderedby_name: String
    orderedby_type: String
    updatedby: ID
    status: Boolean!
    createdAt: String
    updatedAt: String
  }

  # Payment Input
  input PaymentInput {
    adminid: ID!
    branchid: ID!
    paymentdate: String
    type: String!
    mode: String!
    partyid: ID                  # optional
    ledgerid: ID!                # required
    invoices: [PaymentInvoiceInput!]
    amount: Float!
    reference: String
    remarks: String
    transactionid: ID
    createdby_id: ID
    createdby_name: String
    createdby_type: String
    updatedby: ID
    status: Boolean
  }

  # Payment Filter Input
  input PaymentFilterInput {
    adminid: ID
    branchid: ID
    type: String
    partyid: ID
    ledgerid: ID
    paymentcode: String
    dateFrom: String
    dateTo: String
    status: Boolean
    includeDownline: Boolean
  }

  # Queries
  type Query {
    getPayments(filter: PaymentFilterInput): [Payment!]!
    getDeletedPayments(filter: PaymentFilterInput): [Payment!]!
    getPaymentById(id: ID!, adminid: ID): Payment
  }

  # Mutations
  type Mutation {
    addPayment(input: PaymentInput!): Payment!
    editPayment(id: ID!, input: PaymentInput!): Payment!
    deletePayment(id: ID!): Boolean!
    resetPayment(id: ID!): Boolean!
  }
`;
