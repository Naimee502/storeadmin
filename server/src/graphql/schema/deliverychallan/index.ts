import { gql } from "apollo-server-express";

export const deliveryChallanTypeDefs = gql`
  type DeliveryChallanLine {
    productserviceid: SimpleRef!
    variantid: SimpleRef
    salesunitid: SimpleRef
    unitqty: Float
    qty: Float!
    rate: Float
    discount: Float
    gst: Float
    amount: Float
  }

  input DeliveryChallanLineInput {
    productserviceid: ID!
    variantid: ID
    salesunitid: ID
    unitqty: Float
    qty: Float!
    rate: Float
    discount: Float
    gst: Float
    amount: Float
  }

  type DeliveryChallan {
    id: ID
    partyacc: SimpleRef
    billdate: String!
    billnumber: String
    "Provisional device number the challan was made offline with."
    offlineNumber: String
    reason: String
    notes: String
    sourceorderid: ID
    sourceinvoiceid: ID
    "SO number of the source order, when there is one."
    sourceOrderNumber: String
    "INV number of the source invoice, when there is one."
    sourceInvoiceNumber: String
    "Invoice made from this challan, when there is one."
    invoiceid: ID
    invoicenumber: String
    subtotal: Float
    totaldiscount: Float
    totalgst: Float
    totalamount: Float
    adminid: ID
    branchid: ID
    createdby_name: String
    createdby_type: String
    productservice: [DeliveryChallanLine!]!
    transportname: String
    vehiclenumber: String
    ewaybillno: String
    ewaybilldate: String
    ewaybillvalidupto: String
    distance: Float
    deliverydate: String
    stockapplied: Boolean
    challanStatus: String
    deliveredAt: String
    returnedAt: String
    status: Boolean
    createdAt: String
    "ISO date"
    updatedAt: String
  }

  input DeliveryChallanInput {
    partyacc: ID!
    billdate: String!
    billnumber: String
    reason: String
    notes: String
    sourceorderid: ID
    sourceinvoiceid: ID
    branchid: ID
    subtotal: Float
    totaldiscount: Float
    totalgst: Float
    totalamount: Float
    productservice: [DeliveryChallanLineInput!]!
    transportname: String
    vehiclenumber: String
    ewaybillno: String
    ewaybilldate: String
    ewaybillvalidupto: String
    distance: Float
    deliverydate: String
    clientRequestId: String
  }

  input DeliveryChallanFilterInput {
    branchid: ID
  }

  type DeliveryChallanPage {
    items: [DeliveryChallan!]!
    total: Int!
  }

  extend type Query {
    getDeliveryChallansPage(filter: DeliveryChallanFilterInput, page: Int, pageSize: Int, search: String, columnFilters: [ColumnFilter!]): DeliveryChallanPage!
    getDeletedDeliveryChallans(filter: DeliveryChallanFilterInput): [DeliveryChallan!]!
    getDeliveryChallanById(id: ID!): DeliveryChallan
    "Unsaved challan filled from a Sales Order (sourceType: order) or Sales Invoice (invoice)."
    getDeliveryChallanDraft(sourceType: String!, sourceId: ID!): DeliveryChallan
  }

  extend type Mutation {
    addDeliveryChallan(input: DeliveryChallanInput!): DeliveryChallan
    editDeliveryChallan(id: ID!, input: DeliveryChallanInput!, expectedUpdatedAt: String): DeliveryChallan
    deleteDeliveryChallan(id: ID!, expectedUpdatedAt: String): Boolean
    resetDeliveryChallan(id: ID!): Boolean
    markDeliveryChallanDelivered(id: ID!, expectedUpdatedAt: String): DeliveryChallan
    markDeliveryChallanReturned(id: ID!, expectedUpdatedAt: String): DeliveryChallan
  }
`;
