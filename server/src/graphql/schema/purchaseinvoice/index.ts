import { gql } from 'apollo-server-express';

export const purchaseInvoiceTypeDefs = gql`
  type PurchaseInvoiceProductService {
    productserviceid: ID!
    variantid: ID
    purchaseunitid: ID
    gst: Float!
    qty: Int!
    rate: Float!
    amount: Float!
    discount: Float!
    purchaseaccountid: ID
    salesaccountid: ID
    serviceaccountid: ID
  }

  input PurchaseInvoiceProductServiceInput {
    productserviceid: ID!
    variantid: ID
    purchaseunitid: ID
    gst: Float!
    qty: Int!
    rate: Float!
    amount: Float!
    discount: Float
    purchaseaccountid: ID
    salesaccountid: ID
    serviceaccountid: ID
  }

  type PurchaseInvoice {
    id: ID!
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
    productservice: [PurchaseInvoiceProductService!]!
    isservice: Boolean!
    status: Boolean!
    createdAt: String
    updatedAt: String
  }

  input PurchaseInvoiceInput {
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
    productservice: [PurchaseInvoiceProductServiceInput!]!
    isservice: Boolean
    status: Boolean
  }

  input PurchaseInvoiceFilterInput {
    adminid: ID
    branchid: ID
    supplierid: ID
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
    getPurchaseInvoices(filter: PurchaseInvoiceFilterInput): [PurchaseInvoice!]!
    getDeletedPurchaseInvoices(filter: PurchaseInvoiceFilterInput): [PurchaseInvoice!]!
    getPurchaseInvoiceById(id: ID!, adminid: ID): PurchaseInvoice
  }

  type Mutation {
    addPurchaseInvoice(input: PurchaseInvoiceInput!): PurchaseInvoice!
    editPurchaseInvoice(id: ID!, input: PurchaseInvoiceInput!): PurchaseInvoice!
    deletePurchaseInvoice(id: ID!): Boolean!
    resetPurchaseInvoice(id: ID!): Boolean!
  }
`;
