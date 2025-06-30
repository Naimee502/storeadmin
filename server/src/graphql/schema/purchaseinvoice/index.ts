import { gql } from 'apollo-server-express';

export const purchaseInvoiceTypeDefs = gql`
  type Admin {
    id: ID!
    name: String!
    email: String!
    subscriptionType: String
    subscribed: Boolean
    subscribedAt: String
    subscriptionEnd: String
    transactionId: String
    needsReview: Boolean!
    rejected: Boolean!
  }

  type PurchaseInvoiceProduct {
    productid: ID!
    gst: Float!
    qty: Int!
    rate: Float!
    amount: Float!
    discount: Float!
  }

  input PurchaseInvoiceProductInput {
    productid: ID!
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
    admin: Admin
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
    admin: ID
  }

  type Query {
    getPurchaseInvoices(adminId: ID, branchid: ID): [PurchaseInvoice!]!
    getDeletedPurchaseInvoices(adminId: ID, branchid: ID): [PurchaseInvoice!]!
    getPurchaseInvoice(id: ID!, adminId: ID): PurchaseInvoice
  }

  type Mutation {
    addPurchaseInvoice(input: PurchaseInvoiceInput!): PurchaseInvoice!
    addPurchaseInvoices(inputs: [PurchaseInvoiceInput!]!): [PurchaseInvoice!]!
    editPurchaseInvoice(id: ID!, input: PurchaseInvoiceInput!): PurchaseInvoice!
    deletePurchaseInvoice(id: ID!): Boolean!
    resetPurchaseInvoice(id: ID!): Boolean!
  }
`;
