import { gql } from "apollo-server-express";

export const purchaseReturnTypeDefs = gql`
  type PurchaseReturnProductService {
    productserviceid: SimpleRef!
    variantid: SimpleRef
    purchaseunitid: SimpleRef
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

  input PurchaseReturnProductServiceInput {
    productserviceid: ID!
    variantid: ID
    purchaseunitid: ID
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

  type PurchaseReturn {
    id: ID!
    sourceInvoiceId: ID!
    sourceBillNumber: String
    paymenttype: String!
    partyacc: SimpleRef!
    taxorsupplytype: String!
    returndate: String!
    billtype: String!
    billnumber: String
    notes: String
    reason: String
    refundMode: String
    invoicetype: String!
    subtotal: Float!
    totaldiscount: Float!
    totalgst: Float!
    totalamount: Float!
    adminid: ID!
    branchid: ID!
    productservice: [PurchaseReturnProductService!]!
    othercharges: [OtherCharge]
    deliverydate: String
    duedate: String
    transportname: String
    vehiclenumber: String
    ewaybillno: String
    distance: Float
    roundoff: Float
    invoicediscount: Float
    invoicediscounttype: String
    isservice: Boolean!
    autocreate: Boolean!
    createdby_id: ID
    createdby_name: String
    createdby_type: String
    status: Boolean!
    createdAt: String
    updatedAt: String
  }

  input PurchaseReturnInput {
    sourceInvoiceId: ID!
    sourceBillNumber: String
    paymenttype: String!
    partyacc: ID!
    taxorsupplytype: String
    returndate: String!
    billtype: String
    billnumber: String
    notes: String
    reason: String
    refundMode: String
    invoicetype: String!
    subtotal: Float!
    totaldiscount: Float!
    totalgst: Float!
    totalamount: Float!
    adminid: ID!
    branchid: ID!
    productservice: [PurchaseReturnProductServiceInput!]!
    othercharges: [OtherChargeInput]
    deliverydate: String
    duedate: String
    transportname: String
    vehiclenumber: String
    ewaybillno: String
    distance: Float
    roundoff: Float
    invoicediscount: Float
    invoicediscounttype: String
    isservice: Boolean
    autocreate: Boolean
    createdby_id: ID
    createdby_name: String
    createdby_type: String
    status: Boolean
  }

  input PurchaseReturnFilterInput {
    adminid: ID
    branchid: ID
    sourceInvoiceId: ID
    partyacc: ID
    returndateFrom: String
    returndateTo: String
    status: Boolean
  }

  extend type Query {
    getPurchaseReturns(filter: PurchaseReturnFilterInput): [PurchaseReturn!]!
    getDeletedPurchaseReturns(filter: PurchaseReturnFilterInput): [PurchaseReturn!]!
    getPurchaseReturnById(id: ID!, adminid: ID): PurchaseReturn
  }

  extend type Mutation {
    addPurchaseReturn(input: PurchaseReturnInput!): PurchaseReturn!
    editPurchaseReturn(id: ID!, input: PurchaseReturnInput!): PurchaseReturn!
    deletePurchaseReturn(id: ID!): Boolean!
    resetPurchaseReturn(id: ID!): Boolean!
  }
`;
