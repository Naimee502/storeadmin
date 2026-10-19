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
    # Sales Order the source invoice came from ("000039"), if any.
    sourceOrderNumber: String
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

  input SalesReturnFilterInput {
    adminid: ID
    branchid: ID
    sourceInvoiceId: ID
    partyacc: ID
    returndateFrom: String
    returndateTo: String
    status: Boolean
  }

  # Mobile app (salesman / delivery boy): invoices this user can book a
  # return against — only ones with something left to return.
  type ReturnableSalesInvoice {
    id: ID!
    billnumber: String
    billdate: String
    totalamount: Float
    partyId: ID
    partyName: String
    partyMobile: String
    deliveryStatus: String
    # Sales Order this bill was converted from ("000039"), if any.
    orderNumber: String
    returnableQty: Float!
  }

  type SalesReturnDraftLine {
    productserviceid: ID!
    productName: String
    variantid: ID
    variantName: String
    salesunitid: ID
    unitname: String
    unitqty: Int
    gst: Float
    rate: Float
    discount: Float
    invoicedQty: Float!
    returnedQty: Float!
    returnableQty: Float!
  }

  # Everything the app needs to build a return for one invoice, with the
  # qty still returnable per line worked out server-side (counts every
  # earlier return, whoever booked it).
  type SalesReturnDraft {
    invoiceId: ID!
    billnumber: String
    billdate: String
    orderNumber: String
    adminid: ID!
    branchid: ID
    partyId: ID
    partyName: String
    partyMobile: String
    salesmenid: ID
    paymenttype: String
    billtype: String
    taxorsupplytype: String
    invoicetype: String
    isservice: Boolean
    lines: [SalesReturnDraftLine!]!
  }

  extend type Query {
    getReturnableSalesInvoices(search: String): [ReturnableSalesInvoice!]!
    getSalesReturnDraft(sourceInvoiceId: ID!): SalesReturnDraft!
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
