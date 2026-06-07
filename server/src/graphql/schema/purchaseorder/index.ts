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
  }
`;
