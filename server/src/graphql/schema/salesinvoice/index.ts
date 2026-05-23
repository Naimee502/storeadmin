import { gql } from 'apollo-server-express';

export const salesInvoiceTypeDefs = gql`

  type SimpleRef {
    id: ID
    name: String
    unitname: String
    accountname: String
    mobile: String
    ledgername: String
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
    isservice: Boolean!
    autocreate: Boolean!
    createdby_id: ID
    createdby_name: String
    createdby_type: String
    status: Boolean!
    createdAt: String
    updatedAt: String
  }

  input SalesInvoiceInput {
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
    isservice: Boolean
    autocreate: Boolean
    createdby_id: ID
    createdby_name: String
    createdby_type: String
    status: Boolean
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
  }

  type Query {
    getSalesInvoices(filter: SalesInvoiceFilterInput): [SalesInvoice!]!
    getDeletedSalesInvoices(filter: SalesInvoiceFilterInput): [SalesInvoice!]!
    getSalesInvoiceById(id: ID!, adminid: ID): SalesInvoice
  }

  type Mutation {
    addSalesInvoice(input: SalesInvoiceInput!): SalesInvoice!
    editSalesInvoice(id: ID!, input: SalesInvoiceInput!): SalesInvoice!
    deleteSalesInvoice(id: ID!): Boolean!
    resetSalesInvoice(id: ID!): Boolean!
  }
`;
