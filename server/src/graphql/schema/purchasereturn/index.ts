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
    "ISO date"
    updatedAt: String
    offlineNumber: String
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
    "Set by offline sync so a retried save returns the same document."
    clientRequestId: String
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

  type PurchaseReturnPage {
    items: [PurchaseReturn!]!
    total: Int!
  }

  extend type Query {
    getPurchaseReturns(filter: PurchaseReturnFilterInput): [PurchaseReturn!]!
    getPurchaseReturnsPage(filter: PurchaseReturnFilterInput, page: Int, pageSize: Int, search: String, columnFilters: [ColumnFilter!]): PurchaseReturnPage!
    getDeletedPurchaseReturns(filter: PurchaseReturnFilterInput): [PurchaseReturn!]!
    getPurchaseReturnById(id: ID!, adminid: ID): PurchaseReturn
  }

  extend type Mutation {
    addPurchaseReturn(input: PurchaseReturnInput!): PurchaseReturn!
    "expectedUpdatedAt: optional; when it differs from the stored updatedAt the edit fails with CONFLICT."
    editPurchaseReturn(id: ID!, input: PurchaseReturnInput!, expectedUpdatedAt: String): PurchaseReturn!
    deletePurchaseReturn(id: ID!, expectedUpdatedAt: String): Boolean!
    resetPurchaseReturn(id: ID!): Boolean!
  }
`;
