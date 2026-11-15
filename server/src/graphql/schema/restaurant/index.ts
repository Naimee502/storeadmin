import { gql } from "apollo-server-express";

export const restaurantTypeDefs = gql`
  type DiningTable { id: ID! name: String! area: String seats: Int sortorder: Int branchid: ID }
  input DiningTableInput { name: String! area: String seats: Int sortorder: Int branchid: ID }

  type TableOrderLine {
    id: ID!
    productserviceid: ID
    variantid: ID
    salesunitid: ID
    name: String
    qty: Float!
    rate: Float
    note: String
    "Set once the item is sent to the kitchen."
    kotno: Int
    kotAt: String
    cancelled: Boolean
    billedqty: Float
  }
  "An item not sent to the kitchen yet."
  input TableOrderLineInput { productserviceid: ID variantid: ID salesunitid: ID name: String qty: Float! rate: Float note: String }
  input TableBillLineInput { id: ID! qty: Float! }

  type TableOrder {
    id: ID!
    tableid: ID!
    tablename: String
    branchid: ID
    covers: Int
    waitername: String
    lines: [TableOrderLine!]!
    kotcount: Int
    "open, billed or cancelled"
    orderStatus: String!
    invoiceids: [ID!]
    "Qty x rate of items not cancelled (before tax)."
    total: Float
    createdby_name: String
    createdAt: String
    updatedAt: String
  }

  extend type Query {
    getDiningTables(branchid: ID): [DiningTable!]!
    "Running bills of the tables."
    getOpenTableOrders(branchid: ID): [TableOrder!]!
    getTableOrder(id: ID!): TableOrder
  }
  extend type Mutation {
    saveDiningTable(id: ID, input: DiningTableInput!): DiningTable!
    "Refused while the table has a running bill."
    deleteDiningTable(id: ID!): Boolean!
    "Starts the table's running bill, or returns the one already running."
    openTableOrder(tableid: ID!, covers: Int, waitername: String): TableOrder!
    "Replaces the items not sent to the kitchen; sendKot sends them as the next KOT."
    saveTableOrder(id: ID!, lines: [TableOrderLineInput!]!, covers: Int, waitername: String, sendKot: Boolean): TableOrder!
    "Cancels an item already sent to the kitchen (not billed)."
    cancelTableOrderLine(id: ID!, lineid: ID!): TableOrder!
    "Moves the running bill to a free table."
    moveTableOrder(id: ID!, tableid: ID!): TableOrder!
    "Cancels a running bill that has nothing billed."
    cancelTableOrder(id: ID!): Boolean!
    "Marks the items of a saved Sales Invoice as billed; the table is free once every item is billed."
    billTableOrder(id: ID!, invoiceid: ID!, lines: [TableBillLineInput!]!): TableOrder!
  }
`;
