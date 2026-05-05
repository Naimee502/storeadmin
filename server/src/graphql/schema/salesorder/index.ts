import { gql } from 'apollo-server-express';

export const salesOrderTypeDefs = gql`

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
    isservice: Boolean!
    createdby_id: ID
    createdby_name: String
    createdby_type: String
    isConverted: Boolean
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
    isservice: Boolean
    createdby_id: ID
    createdby_name: String
    createdby_type: String
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
  }
`;
