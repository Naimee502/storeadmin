import { gql } from 'apollo-server-express';

export const salesInvoiceTypeDefs = gql`
  type SalesInvoiceProduct {
    id: ID!
    gst: Float!
    qty: Int!
    rate: Float!
    amount: Float!
    discount: Float!   # <-- ADD THIS
  }

  input SalesInvoiceProductInput {
    id: ID!
    gst: Float!
    qty: Int!
    rate: Float!
    amount: Float!
    discount: Float!   # <-- ADD THIS
  }

  type SalesInvoice {
    id: ID!
    branchid: ID!
    paymenttype: String!
    partyacc: String!
    taxorsupplytype: String!
    billdate: String!
    billtype: String!
    billnumber: String!
    notes: String
    invoicetype: String!
    subtotal: Float!
    totaldiscount: Float!
    totalgst: Float!
    totalamount: Float!
    products: [SalesInvoiceProduct!]!
    status: Boolean!
  }

  input SalesInvoiceInput {
    branchid: ID!
    paymenttype: String!
    partyacc: String!
    taxorsupplytype: String!
    billdate: String!
    billtype: String!
    billnumber: String!
    notes: String
    invoicetype: String!
    subtotal: Float!
    totaldiscount: Float!
    totalgst: Float!
    totalamount: Float!
    products: [SalesInvoiceProductInput!]!
    status: Boolean!
  }

  type Query {
    getSalesInvoices(branchid: String): [SalesInvoice!]!
    getDeletedSalesInvoices(branchid: String): [SalesInvoice!]!
    getSalesInvoice(id: ID!): SalesInvoice
  }

  type Mutation {
    addSalesInvoice(input: SalesInvoiceInput!): SalesInvoice!
    addSalesInvoices(inputs: [SalesInvoiceInput!]!): [SalesInvoice!]!
    editSalesInvoice(id: ID!, input: SalesInvoiceInput!): SalesInvoice!
    deleteSalesInvoice(id: ID!): Boolean!
    resetSalesInvoice(id: ID!): Boolean!
  }
`;
