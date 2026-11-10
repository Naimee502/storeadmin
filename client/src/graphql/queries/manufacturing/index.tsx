import { gql } from "@apollo/client";

const LINE = `productserviceid { id name } variantid { id name } salesunitid { id unitname } unitqty qty wastage rate amount note`;

export const BOM_FIELDS = `
  id name qty overhead isdefault notes status createdAt updatedAt
  productserviceid { id name } variantid { id name } salesunitid { id unitname }
  items { ${LINE} }
  byproducts { ${LINE} }
  operations { name workcenter minutes costperhour outsourced }
`;

export const WORK_ORDER_FIELDS = `
  id branchid billnumber offlineNumber billdate duedate bomid qty qtyproduced sourceorderid workStatus notes createdby_name status createdAt updatedAt
  productserviceid { id name } variantid { id name } salesunitid { id unitname }
`;

export const PRODUCTION_FIELDS = `
  id branchid billnumber offlineNumber billdate workorderid workordernumber bomid labourcost overhead materialcost totalcost
  qcstatus serials batchnumber notes createdby_name status createdAt updatedAt
  components { ${LINE} }
  outputs { ${LINE} }
  byproducts { ${LINE} }
  qctests { parameter expected actual ok }
`;

export const GET_BOMS = gql`query GetBoms { getBoms { ${BOM_FIELDS} } }`;
export const GET_DELETED_BOMS = gql`query GetDeletedBoms { getDeletedBoms { ${BOM_FIELDS} } }`;
export const GET_BOM_BY_ID = gql`query GetBomById($id: ID!) { getBomById(id: $id) { ${BOM_FIELDS} } }`;

export const GET_WORK_ORDERS = gql`query GetWorkOrders($filter: MfgFilterInput) { getWorkOrders(filter: $filter) { ${WORK_ORDER_FIELDS} } }`;
export const GET_DELETED_WORK_ORDERS = gql`query GetDeletedWorkOrders($filter: MfgFilterInput) { getDeletedWorkOrders(filter: $filter) { ${WORK_ORDER_FIELDS} } }`;
export const GET_WORK_ORDER_BY_ID = gql`query GetWorkOrderById($id: ID!) { getWorkOrderById(id: $id) { ${WORK_ORDER_FIELDS} } }`;

export const GET_PRODUCTION_ENTRIES = gql`query GetProductionEntries($filter: MfgFilterInput) { getProductionEntries(filter: $filter) { ${PRODUCTION_FIELDS} } }`;
export const GET_DELETED_PRODUCTION_ENTRIES = gql`query GetDeletedProductionEntries($filter: MfgFilterInput) { getDeletedProductionEntries(filter: $filter) { ${PRODUCTION_FIELDS} } }`;
export const GET_PRODUCTION_ENTRY_BY_ID = gql`query GetProductionEntryById($id: ID!) { getProductionEntryById(id: $id) { ${PRODUCTION_FIELDS} } }`;

const PAGE_ARGS = "$page: Int, $pageSize: Int, $search: String, $columnFilters: [ColumnFilter!]";
const PAGE_VARS = "page: $page, pageSize: $pageSize, search: $search, columnFilters: $columnFilters";
export const GET_BOMS_PAGE = gql`query GetBomsPage(${PAGE_ARGS}) { getBomsPage(${PAGE_VARS}) { items { ${BOM_FIELDS} } total } }`;
export const GET_WORK_ORDERS_PAGE = gql`query GetWorkOrdersPage($filter: MfgFilterInput, ${PAGE_ARGS}) { getWorkOrdersPage(filter: $filter, ${PAGE_VARS}) { items { ${WORK_ORDER_FIELDS} } total } }`;
export const GET_PRODUCTION_ENTRIES_PAGE = gql`query GetProductionEntriesPage($filter: MfgFilterInput, ${PAGE_ARGS}) { getProductionEntriesPage(filter: $filter, ${PAGE_VARS}) { items { ${PRODUCTION_FIELDS} } total } }`;
