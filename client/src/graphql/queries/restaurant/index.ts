import { gql } from "@apollo/client";

const ORDER = `
  id tableid tablename branchid covers waitername kotcount orderStatus invoiceids total createdby_name createdAt updatedAt
  lines { id productserviceid variantid salesunitid name qty rate note kotno kotAt cancelled billedqty }
`;

export const GET_DINING_TABLES = gql`
  query GetDiningTables($branchid: ID) { getDiningTables(branchid: $branchid) { id name area seats sortorder branchid } }
`;
export const GET_OPEN_TABLE_ORDERS = gql`
  query GetOpenTableOrders($branchid: ID) { getOpenTableOrders(branchid: $branchid) { ${ORDER} } }
`;
export const SAVE_DINING_TABLE = gql`
  mutation SaveDiningTable($id: ID, $input: DiningTableInput!) { saveDiningTable(id: $id, input: $input) { id name area seats sortorder branchid } }
`;
export const DELETE_DINING_TABLE = gql`
  mutation DeleteDiningTable($id: ID!) { deleteDiningTable(id: $id) }
`;
export const OPEN_TABLE_ORDER = gql`
  mutation OpenTableOrder($tableid: ID!) { openTableOrder(tableid: $tableid) { ${ORDER} } }
`;
export const SAVE_TABLE_ORDER = gql`
  mutation SaveTableOrder($id: ID!, $lines: [TableOrderLineInput!]!, $covers: Int, $waitername: String, $sendKot: Boolean) {
    saveTableOrder(id: $id, lines: $lines, covers: $covers, waitername: $waitername, sendKot: $sendKot) { ${ORDER} }
  }
`;
export const CANCEL_TABLE_ORDER_LINE = gql`
  mutation CancelTableOrderLine($id: ID!, $lineid: ID!) { cancelTableOrderLine(id: $id, lineid: $lineid) { ${ORDER} } }
`;
export const MOVE_TABLE_ORDER = gql`
  mutation MoveTableOrder($id: ID!, $tableid: ID!) { moveTableOrder(id: $id, tableid: $tableid) { ${ORDER} } }
`;
export const CANCEL_TABLE_ORDER = gql`
  mutation CancelTableOrder($id: ID!) { cancelTableOrder(id: $id) }
`;
export const BILL_TABLE_ORDER = gql`
  mutation BillTableOrder($id: ID!, $invoiceid: ID!, $lines: [TableBillLineInput!]!) { billTableOrder(id: $id, invoiceid: $invoiceid, lines: $lines) { id orderStatus } }
`;
