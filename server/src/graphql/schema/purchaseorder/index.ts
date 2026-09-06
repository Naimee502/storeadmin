import { gql } from 'apollo-server-express';

export const purchaseOrderTypeDefs = gql`

  type SimpleRef {
    id: ID
    name: String
    unitname: String
    accountname: String
    mobile: String
    ledgername: String
    address: String
    city: String
    # Needed by the printable document: state builds Place of Supply and
    # gstnumber fills the GSTIN cell, the same two fields the invoice
    # modules already expose on their SimpleRef.
    state: String
    gstnumber: String
    latitude: Float
    longitude: Float
  }

  type OtherCharge {
    ledgerid: SimpleRef
    ledgername: String
    amount: Float
    gstpercent: Float
    gstamount: Float
    totalamount: Float
    remarks: String
  }

  input OtherChargeInput {
    ledgerid: ID!
    ledgername: String
    amount: Float!
    gstpercent: Float
    gstamount: Float
    totalamount: Float!
    remarks: String
  }

  type PurchaseOrderProductService {
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

  input PurchaseOrderProductServiceInput {
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

  type PurchaseOrder {
    id: ID!
    purchasemenid: SimpleRef
    paymenttype: String!
    partyacc: SimpleRef!
    taxorsupplytype: String!
    billdate: String!
    billtype: String!
    billnumber: String
    notes: String
    ordertype: String
    subtotal: Float!
    totaldiscount: Float!
    totalgst: Float!
    totalamount: Float!
    adminid: ID!
    branchid: ID!
    productservice: [PurchaseOrderProductService!]!
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
    createdby_id: ID
    createdby_name: String
    createdby_type: String
    isConverted: Boolean
    # Canonical lifecycle: pending → confirmed → received (+ cancelled/returned).
    orderStatus: String
    receivedAt: String
    receivedByName: String
    # Real invoice number once converted — null for a purchase-order-only
    # business, which never shows its users an invoice number.
    invoicenumber: String
    # What is still payable on the invoice this order became. 0 if not billed.
    outstanding: Float
    cancelStatus: String
    cancelReason: String
    cancelledAt: String
    status: Boolean!
    createdAt: String
    updatedAt: String
  }

  input PurchaseOrderInput {
    purchasemenid: ID
    paymenttype: String!
    partyacc: ID!
    taxorsupplytype: String
    billdate: String!
    billtype: String
    billnumber: String
    notes: String
    ordertype: String
    subtotal: Float!
    totaldiscount: Float!
    totalgst: Float!
    totalamount: Float!
    adminid: ID!
    branchid: ID!
    productservice: [PurchaseOrderProductServiceInput!]!
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
    createdby_id: ID
    createdby_name: String
    createdby_type: String
    isConverted: Boolean
    orderStatus: String
    status: Boolean
  }

  input PurchaseOrderFilterInput {
    adminid: ID
    branchid: ID
    purchasemenid: ID
    paymenttype: String
    partyacc: ID
    taxorsupplytype: String
    billtype: String
    ordertype: String
    billdateFrom: String
    billdateTo: String
    isConverted: Boolean
    includeConverted: Boolean
    status: Boolean
  }

  extend type Query {
    getPurchaseOrders(filter: PurchaseOrderFilterInput): [PurchaseOrder!]!
    getDeletedPurchaseOrders(filter: PurchaseOrderFilterInput): [PurchaseOrder!]!
    getPurchaseOrderById(id: ID!): PurchaseOrder
  }

  extend type Mutation {
    addPurchaseOrder(input: PurchaseOrderInput!): PurchaseOrder!
    editPurchaseOrder(id: ID!, input: PurchaseOrderInput!): PurchaseOrder!
    deletePurchaseOrder(id: ID!): Boolean!
    resetPurchaseOrder(id: ID!): Boolean!
    cancelPurchaseOrder(id: ID!, reason: String): PurchaseOrder!
    reopenPurchaseOrder(id: ID!): PurchaseOrder!
    confirmPurchaseOrder(id: ID!): PurchaseOrder!
    markPurchaseOrderReceived(id: ID!, byId: ID, byName: String, byType: String): PurchaseOrder!
  }
`;
