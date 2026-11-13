import { gql } from "@apollo/client";

// Stock report fields; same variables as GET_PRODUCT_SERVICES so stock is branch-scoped.
export const STOCK_REPORT_PRODUCTS = gql`
  query StockReportProducts($filter: ProductServiceFilterInput, $limit: Int, $offset: Int) {
    getProductServices(filter: $filter, limit: $limit, offset: $offset) {
      id
      name
      isservice
      productvariants {
        id
        name
        currentstock
        currentstockamount
        minimumstock
        reorderlevel
        racklocation
      }
    }
  }
`;

// Stock ledger rows (newest first).
export const GET_STOCK_MOVES = gql`
  query GetStockMoves($productid: ID, $branchid: ID, $from: String, $to: String, $limit: Int, $offset: Int) {
    getStockMoves(productid: $productid, branchid: $branchid, from: $from, to: $to, limit: $limit, offset: $offset) {
      total
      rows { id productid productname variantid qty balance doctype docno date note createdAt }
    }
  }
`;
