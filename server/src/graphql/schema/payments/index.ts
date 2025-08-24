import { gql } from "apollo-server-express";

export const paymentTypeDefs = gql`
  # Payment Invoice Settlement Line
  type PaymentInvoice {
    invoiceid: ID!
    invoicemodel: String!
    settledamount: Float!
  }

  input PaymentInvoiceInput {
    invoiceid: ID!
    invoicemodel: String!
    settledamount: Float!
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
    partyid: ID!
    invoices: [PaymentInvoice!]
    amount: Float!
    reference: String
    remarks: String
    transactionid: ID
    createdby: ID
    updatedby: ID
    status: Boolean!
    createdAt: String
    updatedAt: String
  }

  input PaymentInput {
    adminid: ID!
    branchid: ID!
    paymentdate: String
    type: String!
    mode: String!
    partyid: ID!
    invoices: [PaymentInvoiceInput!]
    amount: Float!
    reference: String
    remarks: String
    transactionid: ID
    createdby: ID
    updatedby: ID
    status: Boolean
  }

  input PaymentFilterInput {
    adminid: ID
    branchid: ID
    type: String
    partyid: ID
    paymentcode: String
    dateFrom: String
    dateTo: String
    status: Boolean
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
