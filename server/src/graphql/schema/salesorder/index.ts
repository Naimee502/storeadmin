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
    # Needed by the printable document: state builds Place of Supply and
    # gstnumber fills the GSTIN cell, the same two fields the invoice
    # modules already expose on their SimpleRef.
    state: String
    gstnumber: String
    latitude: Float
    longitude: Float
    imageurl: String
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
    routeid: ID
    ordersource: String
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
    # Id of the invoice this order became (null until converted).
    invoiceid: ID
    outstanding: Float
    # Party Previous / Current Balance (as printed on the invoice). Null until
    # converted, or when Invoice Print → "Party Previous / Current balance" is off.
    partyPreviousBalance: Float
    partyCurrentBalance: Float
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
    "ISO date"
    updatedAt: String
    offlineNumber: String
  }

  input SalesOrderInput {
    salesmenid: ID
    routeid: ID
    ordersource: String
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
    "Set by offline sync so a retried save returns the same document."
    clientRequestId: String
  }

  input SalesOrderFilterInput {
    adminid: ID
    branchid: ID
    salesmenid: ID
    routeid: ID
    ordersource: String
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

  type SalesOrderPage {
    items: [SalesOrder!]!
    total: Int!
  }

  extend type Query {
    getSalesOrders(filter: SalesOrderFilterInput): [SalesOrder!]!
    getSalesOrdersPage(filter: SalesOrderFilterInput, page: Int, pageSize: Int, search: String, columnFilters: [ColumnFilter!]): SalesOrderPage!
    getDeletedSalesOrders(filter: SalesOrderFilterInput): [SalesOrder!]!
    getSalesOrderById(id: ID!): SalesOrder
  }

  extend type Mutation {
    addSalesOrder(input: SalesOrderInput!): SalesOrder!
    "expectedUpdatedAt: optional; when it differs from the stored updatedAt the edit fails with CONFLICT."
    editSalesOrder(id: ID!, input: SalesOrderInput!, expectedUpdatedAt: String): SalesOrder!
    deleteSalesOrder(id: ID!, expectedUpdatedAt: String): Boolean!
    resetSalesOrder(id: ID!): Boolean!
    cancelSalesOrder(id: ID!, reason: String, expectedUpdatedAt: String): SalesOrder!
    reopenSalesOrder(id: ID!, expectedUpdatedAt: String): SalesOrder!
    # Fulfilment transitions
    confirmSalesOrder(id: ID!, expectedUpdatedAt: String): SalesOrder!
    markSalesOrderDispatched(id: ID!, deliveryboyid: ID, expectedUpdatedAt: String): SalesOrder!
    markSalesOrderDelivered(id: ID!, byId: ID, byName: String, byType: String, expectedUpdatedAt: String): SalesOrder!
    assignOrderDeliveryBoy(id: ID!, deliveryboyid: ID!, expectedUpdatedAt: String): SalesOrder!
  }
`;
