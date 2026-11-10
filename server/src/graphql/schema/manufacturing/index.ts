import { gql } from "apollo-server-express";

export const manufacturingTypeDefs = gql`
  type MfgLine {
    productserviceid: SimpleRef!
    variantid: SimpleRef
    salesunitid: SimpleRef
    unitqty: Float
    qty: Float!
    wastage: Float
    rate: Float
    amount: Float
    note: String
  }

  input MfgLineInput {
    productserviceid: ID!
    variantid: ID
    salesunitid: ID
    unitqty: Float
    qty: Float!
    wastage: Float
    rate: Float
    amount: Float
    note: String
  }

  type MfgOperation {
    name: String!
    workcenter: String
    minutes: Float
    costperhour: Float
    outsourced: Boolean
  }

  input MfgOperationInput {
    name: String!
    workcenter: String
    minutes: Float
    costperhour: Float
    outsourced: Boolean
  }

  type QcTest {
    parameter: String
    expected: String
    actual: String
    ok: Boolean
  }

  input QcTestInput {
    parameter: String
    expected: String
    actual: String
    ok: Boolean
  }

  type Bom {
    id: ID
    adminid: ID
    name: String
    productserviceid: SimpleRef!
    variantid: SimpleRef
    salesunitid: SimpleRef
    qty: Float!
    items: [MfgLine!]
    byproducts: [MfgLine!]
    operations: [MfgOperation!]
    overhead: Float
    isdefault: Boolean
    notes: String
    createdby_name: String
    status: Boolean
    createdAt: String
    updatedAt: String
  }

  input BomInput {
    name: String
    productserviceid: ID!
    variantid: ID
    salesunitid: ID
    qty: Float!
    items: [MfgLineInput!]
    byproducts: [MfgLineInput!]
    operations: [MfgOperationInput!]
    overhead: Float
    isdefault: Boolean
    notes: String
    clientRequestId: String
  }

  type WorkOrder {
    id: ID
    adminid: ID
    branchid: ID
    billnumber: String
    offlineNumber: String
    billdate: String!
    duedate: String
    bomid: ID
    productserviceid: SimpleRef!
    variantid: SimpleRef
    salesunitid: SimpleRef
    qty: Float!
    qtyproduced: Float
    sourceorderid: ID
    workStatus: String
    notes: String
    createdby_name: String
    status: Boolean
    createdAt: String
    updatedAt: String
  }

  input WorkOrderInput {
    billnumber: String
    billdate: String!
    duedate: String
    branchid: ID
    bomid: ID
    productserviceid: ID!
    variantid: ID
    salesunitid: ID
    qty: Float!
    sourceorderid: ID
    notes: String
    clientRequestId: String
  }

  type ProductionEntry {
    id: ID
    adminid: ID
    branchid: ID
    billnumber: String
    offlineNumber: String
    billdate: String!
    workorderid: ID
    workordernumber: String
    bomid: ID
    components: [MfgLine!]
    outputs: [MfgLine!]
    byproducts: [MfgLine!]
    labourcost: Float
    overhead: Float
    materialcost: Float
    totalcost: Float
    qcstatus: String
    qctests: [QcTest!]
    serials: [String!]
    batchnumber: String
    notes: String
    createdby_name: String
    status: Boolean
    createdAt: String
    updatedAt: String
  }

  input ProductionEntryInput {
    billnumber: String
    billdate: String!
    branchid: ID
    workorderid: ID
    bomid: ID
    components: [MfgLineInput!]
    outputs: [MfgLineInput!]!
    byproducts: [MfgLineInput!]
    labourcost: Float
    overhead: Float
    qcstatus: String
    qctests: [QcTestInput!]
    serials: [String!]
    batchnumber: String
    notes: String
    clientRequestId: String
  }

  input MfgFilterInput {
    branchid: ID
    billdateFrom: String
    billdateTo: String
  }

  type BomPage {
    items: [Bom!]!
    total: Int!
  }

  type WorkOrderPage {
    items: [WorkOrder!]!
    total: Int!
  }

  type ProductionEntryPage {
    items: [ProductionEntry!]!
    total: Int!
  }

  extend type Query {
    getBomsPage(page: Int, pageSize: Int, search: String, columnFilters: [ColumnFilter!]): BomPage!
    getWorkOrdersPage(filter: MfgFilterInput, page: Int, pageSize: Int, search: String, columnFilters: [ColumnFilter!]): WorkOrderPage!
    getProductionEntriesPage(filter: MfgFilterInput, page: Int, pageSize: Int, search: String, columnFilters: [ColumnFilter!]): ProductionEntryPage!
    getBoms: [Bom!]!
    getDeletedBoms: [Bom!]!
    getBomById(id: ID!): Bom
    getWorkOrders(filter: MfgFilterInput): [WorkOrder!]!
    getDeletedWorkOrders(filter: MfgFilterInput): [WorkOrder!]!
    getWorkOrderById(id: ID!): WorkOrder
    getProductionEntries(filter: MfgFilterInput): [ProductionEntry!]!
    getDeletedProductionEntries(filter: MfgFilterInput): [ProductionEntry!]!
    getProductionEntryById(id: ID!): ProductionEntry
  }

  extend type Mutation {
    addBom(input: BomInput!): Bom
    editBom(id: ID!, input: BomInput!, expectedUpdatedAt: String): Bom
    deleteBom(id: ID!, expectedUpdatedAt: String): Boolean
    resetBom(id: ID!): Boolean
    addWorkOrder(input: WorkOrderInput!): WorkOrder
    editWorkOrder(id: ID!, input: WorkOrderInput!, expectedUpdatedAt: String): WorkOrder
    "planned, inprogress, completed or cancelled."
    setWorkOrderStatus(id: ID!, workStatus: String!, expectedUpdatedAt: String): WorkOrder
    deleteWorkOrder(id: ID!, expectedUpdatedAt: String): Boolean
    resetWorkOrder(id: ID!): Boolean
    addProductionEntry(input: ProductionEntryInput!): ProductionEntry
    editProductionEntry(id: ID!, input: ProductionEntryInput!, expectedUpdatedAt: String): ProductionEntry
    deleteProductionEntry(id: ID!, expectedUpdatedAt: String): Boolean
    resetProductionEntry(id: ID!): Boolean
  }
`;
