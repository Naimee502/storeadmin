import { gql } from 'apollo-server-express';

export const purchaseInvoiceTypeDefs = gql`
  type PurchaseInvoiceProduct {
    id: ID!
    gst: Float!
    qty: Int!
    rate: Float!
    amount: Float!
    discount: Float!   # <-- same discount field
  }

  input PurchaseInvoiceProductInput {
    id: ID!
    gst: Float!
    qty: Int!
    rate: Float!
    amount: Float!
    discount: Float!
  }

  type PurchaseInvoice {
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
    products: [PurchaseInvoiceProduct!]!
    status: Boolean!
  }

  input PurchaseInvoiceInput {
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
    products: [PurchaseInvoiceProductInput!]!
    status: Boolean!
  }

  type Query {
    getPurchaseInvoices: [PurchaseInvoice!]!
    getPurchaseInvoice(id: ID!): PurchaseInvoice
  }

  type Mutation {
    addPurchaseInvoice(input: PurchaseInvoiceInput!): PurchaseInvoice!
    addPurchaseInvoices(inputs: [PurchaseInvoiceInput!]!): [PurchaseInvoice!]!
    editPurchaseInvoice(id: ID!, input: PurchaseInvoiceInput!): PurchaseInvoice!
    deletePurchaseInvoice(id: ID!): Boolean!
  }
`;
