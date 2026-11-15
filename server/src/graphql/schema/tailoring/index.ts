import { gql } from "apollo-server-express";

export const tailoringTypeDefs = gql`
  type MeasureValue { key: String! label: String value: String }
  input MeasureValueInput { key: String! label: String value: String }

  type Measurement {
    id: ID
    branchid: ID
    partyacc: ServiceParty
    customername: String
    customermobile: String
    garment: String!
    values: [MeasureValue!]
    "inch or cm"
    unit: String
    takenon: String
    notes: String
    createdby_name: String
    status: Boolean
    createdAt: String
    updatedAt: String
  }
  input MeasurementInput {
    clientRequestId: String
    branchid: ID
    partyacc: ID
    customername: String
    customermobile: String
    garment: String!
    values: [MeasureValueInput!]
    unit: String
    takenon: String
    notes: String
  }

  type TailorItem {
    garment: String!
    productserviceid: SimpleRef
    qty: Float!
    rate: Float
    amount: Float
    "own (customer's cloth) or shop"
    fabric: String
    fabricnote: String
    design: String
    values: [MeasureValue!]
    unit: String
  }
  input TailorItemInput {
    garment: String!
    productserviceid: ID
    qty: Float!
    rate: Float
    amount: Float
    fabric: String
    fabricnote: String
    design: String
    values: [MeasureValueInput!]
    unit: String
  }

  type TailorOrder {
    customfields: [CustomFieldValue!]
    id: ID
    branchid: ID
    partyacc: ServiceParty
    customername: String
    customermobile: String
    billnumber: String
    billdate: String!
    items: [TailorItem!]
    staffid: SimpleRef
    trialdate: String
    deliverydate: String
    "received, cutting, stitching, trial, ready, delivered, cancelled"
    orderStatus: String
    total: Float
    "Receipts for this order (Payments with the order number as reference)."
    advance: Float
    invoiceid: ID
    deliveredAt: String
    notes: String
    createdby_name: String
    status: Boolean
    createdAt: String
    updatedAt: String
  }
  input TailorOrderInput {
    clientRequestId: String
    customfields: [CustomFieldInput!]
    branchid: ID
    partyacc: ID
    customername: String
    customermobile: String
    billdate: String!
    items: [TailorItemInput!]!
    staffid: ID
    trialdate: String
    deliverydate: String
    notes: String
  }
  type TailorOrderPage { items: [TailorOrder!]! total: Int! }

  "A customer's own stitching order."
  type MyTailorOrder {
    id: ID!
    billnumber: String
    billdate: String!
    orderStatus: String!
    trialdate: String
    deliverydate: String
    items: [TailorItem!]!
    total: Float
    advance: Float
    deliveredAt: String
  }

  extend type Query {
    getMeasurements(filter: ServiceFilterInput, search: String): [Measurement!]!
    getDeletedMeasurements(filter: ServiceFilterInput): [Measurement!]!
    "Latest measurement of each garment for a customer."
    getLatestMeasurements(partyacc: ID!): [Measurement!]!
    getTailorOrdersPage(filter: ServiceFilterInput, page: Int, pageSize: Int, search: String, columnFilters: [ColumnFilter!]): TailorOrderPage!
    getTailorOrders(filter: ServiceFilterInput): [TailorOrder!]!
    getDeletedTailorOrders(filter: ServiceFilterInput): [TailorOrder!]!
    getTailorOrderById(id: ID!): TailorOrder
    getMyTailorOrders: [MyTailorOrder!]!
    getMyTailorOrder(id: ID!): MyTailorOrder!
  }

  extend type Mutation {
    addMeasurement(input: MeasurementInput!): Measurement
    editMeasurement(id: ID!, input: MeasurementInput!, expectedUpdatedAt: String): Measurement
    deleteMeasurement(id: ID!, expectedUpdatedAt: String): Boolean
    resetMeasurement(id: ID!): Boolean
    addTailorOrder(input: TailorOrderInput!): TailorOrder
    editTailorOrder(id: ID!, input: TailorOrderInput!, expectedUpdatedAt: String): TailorOrder
    setTailorOrderStatus(id: ID!, orderStatus: String!, expectedUpdatedAt: String): TailorOrder
    deleteTailorOrder(id: ID!, expectedUpdatedAt: String): Boolean
    resetTailorOrder(id: ID!): Boolean
  }
`;
