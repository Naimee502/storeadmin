import { gql } from '@apollo/client';

const TRANSFER_STOCK_FIELDS = gql`
  fragment TransferStockFields on TransferStock {
    id
    vouchernumber
    frombranchid
    tobranchid
    transferdate
    narration
    items {
      productid
      variantid
      transferunitid
      transferqty
      rate
      amount
    }
    totalamount
    status
    createdby_id
    createdby_name
    createdby_type
    admin {
      id
      name
      email
    }
  }
`;

export const GET_TRANSFER_STOCKS = gql`
  ${TRANSFER_STOCK_FIELDS}
  query GetTransferStocks($adminId: ID, $frombranchid: ID) {
    getTransferStocks(adminId: $adminId, frombranchid: $frombranchid) {
      ...TransferStockFields
    }
  }
`;

// Lite list query for the Transfer Stock list page (/transferstock). Same root
// field and arguments as GET_TRANSFER_STOCKS, only the columns the table shows
// (branch/product/unit names are resolved client-side from the lite branch and
// product queries below), narration so the table's global search still finds
// it, and the id the edit/delete actions use. Dashboard, reports and deleted
// entries keep using the full query.
export const GET_TRANSFER_STOCKS_LIST = gql`
  query GetTransferStocksList($adminId: ID, $frombranchid: ID) {
    getTransferStocks(adminId: $adminId, frombranchid: $frombranchid) {
      id
      vouchernumber
      frombranchid
      tobranchid
      transferdate
      narration
      items {
        productid
        variantid
        transferunitid
        transferqty
        rate
      }
      totalamount
      status
      createdby_name
    }
  }
`;

// Product lookup for the Transfer Stock list (product/variant/unit names) and
// the add/edit form picker. Same root field and arguments as
// GET_PRODUCT_SERVICES, but only what those two pages read: product id/name
// and, per variant, id/name, currentstock (available stock), purchaserate
// (default rate) and base unit / unit conversions (unit select + Qty label).
// The full query drags serials, unit prices, ledgers, SEO and service variants
// for every product.
export const GET_TRANSFER_STOCK_PRODUCTS = gql`
  query GetTransferStockProducts($filter: ProductServiceFilterInput, $limit: Int, $offset: Int) {
    getProductServices(filter: $filter, limit: $limit, offset: $offset) {
      id
      name
      productvariants {
        id
        name
        currentstock
        purchaserate
        baseunitid { id unitname }
        unitconversions {
          unitid { id unitname }
          factor
        }
      }
    }
  }
`;

// Branch names for the from/to columns and the destination picker. Same root
// field and arguments as GET_BRANCHES, without the admin/subscription block.
export const GET_TRANSFER_STOCK_BRANCHES = gql`
  query GetTransferStockBranches($adminId: ID) {
    getBranches(adminId: $adminId) {
      id
      branchcode
      branchname
    }
  }
`;

export const GET_DELETED_TRANSFER_STOCKS = gql`
  ${TRANSFER_STOCK_FIELDS}
  query GetDeletedTransferStocks($adminId: ID, $frombranchid: ID) {
    getDeletedTransferStocks(adminId: $adminId, frombranchid: $frombranchid) {
      ...TransferStockFields
    }
  }
`;

export const GET_TRANSFER_STOCK_BY_ID = gql`
  ${TRANSFER_STOCK_FIELDS}
  query GetTransferStockById($id: ID!, $adminId: ID) {
    getTransferStockById(id: $id, adminId: $adminId) {
      ...TransferStockFields
    }
  }
`;
