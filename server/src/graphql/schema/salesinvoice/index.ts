import { gql } from 'apollo-server-express';

export const salesInvoiceTypeDefs = gql`

  type SimpleRef {
    id: ID
    name: String
    unitname: String
    accountname: String
    mobile: String
    ledgername: String
    address: String
    city: String
    state: String
    latitude: Float
    longitude: Float
    gstnumber: String
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

  type SalesInvoiceProductService {
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

  input SalesInvoiceProductServiceInput {
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

  type SalesInvoice {
    paymentsplit: [PaymentSplit!]
    id: ID!
    salesmenid: SimpleRef
    paymenttype: String!
    partyacc: SimpleRef!
    taxorsupplytype: String!
    billdate: String!
    billtype: String!
    billnumber: String
    notes: String
    invoicetype: String
    subtotal: Float!
    totaldiscount: Float!
    totalgst: Float!
    totalamount: Float!
    outstanding: Float
    # Party's running-account balance for the printed invoice's "Previous
    # Balance" / "Current Balance" rows. Only computed when explicitly
    # selected (expensive — sums all of the party's unsettled bills).
    partyPreviousBalance: Float
    partyCurrentBalance: Float
    adminid: ID!
    branchid: ID!
    productservice: [SalesInvoiceProductService!]!
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
    received: Float
    isservice: Boolean!
    autocreate: Boolean!
    createdby_id: ID
    createdby_name: String
    createdby_type: String
    sourceorderid: ID
    sourcechallanid: ID
    "e-Invoice details from the GST portal."
    irn: String
    irnAckNo: String
    irnAckDate: String
    signedQr: String
    irnStatus: String
    ewaybilldate: String
    ewaybillvalidupto: String
    # Source Sales Order number ("000009"), resolved from sourceorderid.
    # Order-only businesses label the bill with this instead of the invoice no.
    sourceorderno: String
    orderedby_id: ID
    orderedby_name: String
    orderedby_type: String
    deliveryStatus: String
    deliveredAt: String
    deliveredByName: String
    deliveredByType: String
    deliveryboyid: ID
    cancelStatus: String
    cancelReason: String
    cancelledAt: String
    cancelledByName: String
    status: Boolean!
    createdAt: String
    "ISO date"
    updatedAt: String
    offlineNumber: String
  }

  "One part of a split POS payment."
  input PaymentSplitInput {
    mode: String!
    amount: Float!
  }

  type PaymentSplit {
    mode: String
    amount: Float
  }

  input SalesInvoiceInput {
    "POS split payment (cash + UPI + card...); each part gets its own receipt. received is their sum."
    paymentsplit: [PaymentSplitInput!]
    salesmenid: ID
    paymenttype: String!
    partyacc: ID!  
    taxorsupplytype: String
    billdate: String!
    billtype: String
    billnumber: String
    notes: String
    invoicetype: String
    subtotal: Float!
    totaldiscount: Float!
    totalgst: Float!
    totalamount: Float!
    adminid: ID!
    branchid: ID!
    productservice: [SalesInvoiceProductServiceInput!]!
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
    received: Float
    isservice: Boolean
    autocreate: Boolean
    createdby_id: ID
    createdby_name: String
    createdby_type: String
    sourceorderid: ID
    sourcechallanid: ID
    orderedby_id: ID
    orderedby_name: String
    orderedby_type: String
    status: Boolean
    "Set by offline sync so a retried save returns the same document."
    clientRequestId: String
  }

  type SalesInvoicePage {
    items: [SalesInvoice!]!
    total: Int!
  }

  input SalesInvoiceFilterInput {
    adminid: ID
    branchid: ID
    salesmenid: ID
    paymenttype: String
    partyacc: ID
    taxorsupplytype: String
    billtype: String
    invoicetype: String
    billdateFrom: String
    billdateTo: String
    status: Boolean
    deliveryboyid: ID
    deliveryStatus: String
    unassignedDelivery: Boolean
    includeCancelled: Boolean
  }

  type Query {
    getSalesInvoices(filter: SalesInvoiceFilterInput): [SalesInvoice!]!
    getSalesInvoicesPage(filter: SalesInvoiceFilterInput, page: Int, pageSize: Int, search: String, columnFilters: [ColumnFilter!]): SalesInvoicePage!
    getDeletedSalesInvoices(filter: SalesInvoiceFilterInput): [SalesInvoice!]!
    getSalesInvoiceById(id: ID!, adminid: ID): SalesInvoice
  }

  type Mutation {
    addSalesInvoice(input: SalesInvoiceInput!): SalesInvoice!
    convertSalesOrderToInvoice(id: ID!): SalesInvoice!
    "expectedUpdatedAt: optional; when it differs from the stored updatedAt the edit fails with CONFLICT."
    editSalesInvoice(id: ID!, input: SalesInvoiceInput!, expectedUpdatedAt: String): SalesInvoice!
    deleteSalesInvoice(id: ID!, expectedUpdatedAt: String): Boolean!
    resetSalesInvoice(id: ID!): Boolean!
    cancelSalesInvoice(id: ID!, reason: String, expectedUpdatedAt: String): SalesInvoice
    reopenSalesInvoice(id: ID!, expectedUpdatedAt: String): SalesInvoice
    markSalesInvoiceDispatched(id: ID!, deliveryboyid: ID, expectedUpdatedAt: String): SalesInvoice!
    markSalesInvoiceDelivered(id: ID!, byId: ID, byName: String, byType: String, expectedUpdatedAt: String): SalesInvoice!
    assignInvoiceDeliveryBoy(id: ID!, deliveryboyid: ID!, expectedUpdatedAt: String): SalesInvoice!
    "Save the IRN / QR / e-Way Bill details the GST portal gave for this invoice."
    saveInvoiceGstDetails(id: ID!, input: InvoiceGstInput!, expectedUpdatedAt: String): SalesInvoice!
  }

  input InvoiceGstInput {
    irn: String
    irnAckNo: String
    irnAckDate: String
    signedQr: String
    irnStatus: String
    ewaybillno: String
    ewaybilldate: String
    ewaybillvalidupto: String
  }

  "An e-Invoice / e-Way Bill JSON for the portal, with what blocks it (errors) and what to check (warnings)."
  type GstExport {
    ready: Boolean!
    errors: [String!]!
    warnings: [String!]!
    json: JSON
  }

  extend type Query {
    getEInvoiceExport(invoiceId: ID!): GstExport!
    "sourceType: invoice or challan."
    getEWayBillExport(sourceType: String!, id: ID!): GstExport!
  }
`;
