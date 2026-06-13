import { gql } from 'apollo-server-express';

export const salesOrderTypeDefs = gql`

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

  type SalesOrderProductService {
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

  input SalesOrderProductServiceInput {
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

  type SalesOrder {
    id: ID!
    salesmenid: SimpleRef
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
    productservice: [SalesOrderProductService!]!
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
    lockedTotal: Float
    isConverted: Boolean
    invoicenumber: String
    outstanding: Float
    orderStatus: String
    cancelStatus: String
    cancelReason: String
    cancelledAt: String
    deliveryStatus: String
    deliveredAt: String
    deliveredByName: String
    deliveredByType: String
    deliveryboyid: ID
    status: Boolean!
    createdAt: String
    updatedAt: String
  }

  input SalesOrderInput {
    salesmenid: ID
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
    productservice: [SalesOrderProductServiceInput!]!
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
    lockedTotal: Float
    isConverted: Boolean
    status: Boolean
  }

  input SalesOrderFilterInput {
    adminid: ID
    branchid: ID
    salesmenid: ID
    paymenttype: String
    partyacc: ID
    taxorsupplytype: String
    billtype: String
    ordertype: String
    billdateFrom: String
    billdateTo: String
    isConverted: Boolean
    status: Boolean
    includeConverted: Boolean
    includeDownline: Boolean
    deliveryboyid: ID
    deliveryStatus: String
    unassignedDelivery: Boolean
  }

  extend type Query {
    getSalesOrders(filter: SalesOrderFilterInput): [SalesOrder!]!
    getDeletedSalesOrders(filter: SalesOrderFilterInput): [SalesOrder!]!
    getSalesOrderById(id: ID!): SalesOrder
  }

  extend type Mutation {
    addSalesOrder(input: SalesOrderInput!): SalesOrder!
    editSalesOrder(id: ID!, input: SalesOrderInput!): SalesOrder!
    deleteSalesOrder(id: ID!): Boolean!
    resetSalesOrder(id: ID!): Boolean!
    cancelSalesOrder(id: ID!, reason: String): SalesOrder!
    reopenSalesOrder(id: ID!): SalesOrder!
    # Fulfilment transitions
    confirmSalesOrder(id: ID!): SalesOrder!
    markSalesOrderDispatched(id: ID!, deliveryboyid: ID): SalesOrder!
    markSalesOrderDelivered(id: ID!, byId: ID, byName: String, byType: String): SalesOrder!
    assignOrderDeliveryBoy(id: ID!, deliveryboyid: ID!): SalesOrder!
  }
`;
