import { gql } from 'apollo-server-express';

export const purchaseInvoiceTypeDefs = gql`
  type SimpleRef {
    id: ID
    name: String
    unitname: String
    accountname: String
    mobile: String
    ledgername: String
  }

  type PurchaseInvoiceProductService {
    productserviceid: SimpleRef!
    variantid: SimpleRef
    purchaseunitid: SimpleRef
    unitqty: Int
    gst: Float
    qty: Int
    rate: Float
    amount: Float
    discount: Float
    purchaseaccountid: SimpleRef
    salesaccountid: SimpleRef
    serviceaccountid: SimpleRef
  }

  input PurchaseInvoiceProductServiceInput {
    productserviceid: ID!
    variantid: ID
    purchaseunitid: ID
    unitqty: Int
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
    partyacc: SimpleRef!
    taxorsupplytype: String!
    billdate: String!
    billtype: String!
    billnumber: String
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
    autocreate: Boolean!
    createdby_id: ID
    createdby_name: String
    createdby_type: String
    status: Boolean!
    createdAt: String
    updatedAt: String
  }

  input PurchaseInvoiceInput {
    paymenttype: String!
    partyacc: ID!
    taxorsupplytype: String!
    billdate: String!
    billtype: String!
    billnumber: String
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
    autocreate: Boolean
    createdby_id: ID
    createdby_name: String
    createdby_type: String
    status: Boolean
  }

  input PurchaseInvoiceFilterInput {
    adminid: ID
    branchid: ID
    supplierid: ID
    paymenttype: String
    partyacc: ID
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
