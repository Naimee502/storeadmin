import { gql } from "apollo-server-express";

export const salesReturnTypeDefs = gql`
  # NOTE: SimpleRef is already defined in salesinvoice schema.
  # We re-use the same shape here without redeclaring, since both files are
  # merged into one typeDefs array.

  type SalesReturnProductService {
    productserviceid: SimpleRef!
    variantid: SimpleRef
    salesunitid: SimpleRef
    unitqty: Int
    gst: Float
    qty: Int
    rate: Float
    amount: Float
    discount: Float
    salesaccountid: SimpleRef
    purchaseaccountid: SimpleRef
    serviceaccountid: SimpleRef
  }

  input SalesReturnProductServiceInput {
    productserviceid: ID!
    variantid: ID
    salesunitid: ID
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

  type SalesReturn {
    id: ID!
    sourceInvoiceId: ID!
    sourceBillNumber: String
    salesmenid: SimpleRef
    paymenttype: String!
    partyacc: SimpleRef!
    taxorsupplytype: String!
    returndate: String!
    billtype: String!
    billnumber: String
    notes: String
    reason: String
    refundMode: String
    invoicetype: String
    subtotal: Float!
    totaldiscount: Float!
    totalgst: Float!
    totalamount: Float!
    adminid: ID!
    branchid: ID!
    productservice: [SalesReturnProductService!]!
    isservice: Boolean!
    autocreate: Boolean!
    createdby_id: ID
    createdby_name: String
    createdby_type: String
    status: Boolean!
    createdAt: String
    updatedAt: String
  }

  input SalesReturnInput {
    sourceInvoiceId: ID!
    sourceBillNumber: String
    salesmenid: ID
    paymenttype: String!
    partyacc: ID!
    taxorsupplytype: String
    returndate: String!
    billtype: String
    billnumber: String
    notes: String
    reason: String
    refundMode: String
    invoicetype: String
    subtotal: Float!
    totaldiscount: Float!
    totalgst: Float!
    totalamount: Float!
    adminid: ID!
    branchid: ID!
    productservice: [SalesReturnProductServiceInput!]!
    isservice: Boolean
    autocreate: Boolean
    createdby_id: ID
    createdby_name: String
    createdby_type: String
    status: Boolean
  }

  input SalesReturnFilterInput {
    adminid: ID
    branchid: ID
    sourceInvoiceId: ID
    partyacc: ID
    returndateFrom: String
    returndateTo: String
    status: Boolean
  }

  extend type Query {
    getSalesReturns(filter: SalesReturnFilterInput): [SalesReturn!]!
    getDeletedSalesReturns(filter: SalesReturnFilterInput): [SalesReturn!]!
    getSalesReturnById(id: ID!, adminid: ID): SalesReturn
  }

  extend type Mutation {
    addSalesReturn(input: SalesReturnInput!): SalesReturn!
    editSalesReturn(id: ID!, input: SalesReturnInput!): SalesReturn!
    deleteSalesReturn(id: ID!): Boolean!
    resetSalesReturn(id: ID!): Boolean!
  }
`;
