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

// Lite list for the Transfer Stock page; names resolved client-side.
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

// Product lookup for the Transfer Stock list and form (lite).
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

// Branch names for the from/to columns and destination picker.
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

// One page of the Transfer Stock list (same fields as GET_TRANSFER_STOCKS_LIST).
export const GET_TRANSFER_STOCKS_PAGE = gql`
  query GetTransferStocksPage(
    $adminId: ID
    $frombranchid: ID
    $page: Int
    $pageSize: Int
    $search: String
    $columnFilters: [ColumnFilter!]
  ) {
    getTransferStocksPage(adminId: $adminId, frombranchid: $frombranchid, page: $page, pageSize: $pageSize, search: $search, columnFilters: $columnFilters) {
      total
      items {
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
  }
`;
