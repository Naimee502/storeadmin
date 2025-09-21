import { gql } from 'apollo-server-express';

export const salesInvoiceTypeDefs = gql`
  type SalesInvoiceProductService {
    productserviceid: ID!
    variantid: ID
    salesunitid: ID
    unitqty: Int!
    gst: Float!
    qty: Int!
    rate: Float!
    amount: Float!
    discount: Float!
    salesaccountid: ID
    purchaseaccountid: ID
    serviceaccountid: ID
  }

  input SalesInvoiceProductServiceInput {
    productserviceid: ID!
    variantid: ID
    salesunitid: ID,
    unitqty: Int!
    gst: Float!
    qty: Int!
    rate: Float!
    amount: Float!
    discount: Float
    salesaccountid: ID
    purchaseaccountid: ID
    serviceaccountid: ID
  }

  type SalesInvoice {
    id: ID!
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
    adminid: ID!
    branchid: ID!
    productservice: [SalesInvoiceProductService!]!
    isservice: Boolean!
    status: Boolean!
    createdAt: String
    updatedAt: String
  }

  input SalesInvoiceInput {
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
    adminid: ID!
    branchid: ID!
    productservice: [SalesInvoiceProductServiceInput!]!
    isservice: Boolean
    status: Boolean
  }

  input SalesInvoiceFilterInput {
    adminid: ID
    branchid: ID
    salesmenid: ID
    paymenttype: String
    partyacc: String
    taxorsupplytype: String
    billtype: String
    invoicetype: String
    billdateFrom: String
    billdateTo: String
    status: Boolean
  }

  type Query {
    getSalesInvoices(filter: SalesInvoiceFilterInput): [SalesInvoice!]!
    getDeletedSalesInvoices(filter: SalesInvoiceFilterInput): [SalesInvoice!]!
    getSalesInvoiceById(id: ID!, adminid: ID): SalesInvoice
  }

  type Mutation {
    addSalesInvoice(input: SalesInvoiceInput!): SalesInvoice!
    editSalesInvoice(id: ID!, input: SalesInvoiceInput!): SalesInvoice!
    deleteSalesInvoice(id: ID!): Boolean!
    resetSalesInvoice(id: ID!): Boolean!
  }
`;
