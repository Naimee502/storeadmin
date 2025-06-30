import { gql } from 'apollo-server-express';

export const salesInvoiceTypeDefs = gql`
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

  type SalesInvoiceProduct {
    productid: ID!
    gst: Float!
    qty: Int!
    rate: Float!
    amount: Float!
    discount: Float!
  }

  input SalesInvoiceProductInput {
    productid: ID!
    gst: Float!
    qty: Int!
    rate: Float!
    amount: Float!
    discount: Float!   
  }

  type SalesInvoice {
    id: ID!
    branchid: ID!
    salesmenid: ID!
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
    admin: Admin
  }

  input SalesInvoiceInput {
    branchid: ID!
    salesmenid: ID!
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
    admin: ID
  }

  type Query {
    getSalesInvoices(adminId: ID, branchid: String): [SalesInvoice!]!
    getDeletedSalesInvoices(adminId: ID, branchid: String): [SalesInvoice!]!
    getSalesInvoice(id: ID!, adminId: ID): SalesInvoice
  }

  type Mutation {
    addSalesInvoice(input: SalesInvoiceInput!): SalesInvoice!
    addSalesInvoices(inputs: [SalesInvoiceInput!]!): [SalesInvoice!]!
    editSalesInvoice(id: ID!, input: SalesInvoiceInput!): SalesInvoice!
    deleteSalesInvoice(id: ID!): Boolean!
    resetSalesInvoice(id: ID!): Boolean!
  }
`;
