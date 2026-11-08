import { gql } from "@apollo/client";

export const GET_STOCK_ADJUSTMENTS = gql`
  query GetStockAdjustments($filter: StockAdjustmentFilterInput, $limit: Int, $offset: Int) {
    getStockAdjustments(filter: $filter, limit: $limit, offset: $offset) {
      id
      vouchernumber
      adjustmentdate
      type
      reason
      totalamount
      createdby_id
      createdby_name
      createdby_type
      status
      createdAt
    }
  }
`;

// Lite list for the Stock Adjustments page.
export const GET_STOCK_ADJUSTMENTS_LIST = gql`
  query GetStockAdjustmentsList($filter: StockAdjustmentFilterInput, $limit: Int, $offset: Int) {
    getStockAdjustments(filter: $filter, limit: $limit, offset: $offset) {
      id
      vouchernumber
      adjustmentdate
      type
      reason
      totalamount
      createdby_name
      status
    }
  }
`;

// Product picker for the Stock Adjustment form (lite).
export const GET_STOCK_ADJUSTMENT_PRODUCTS = gql`
  query GetStockAdjustmentProducts($filter: ProductServiceFilterInput, $limit: Int, $offset: Int) {
    getProductServices(filter: $filter, limit: $limit, offset: $offset) {
      id
      name
      productvariants {
        id
        name
        currentstock
        purchaserate
        baseunitid { id }
        purchaseunitid { id }
        unitconversions {
          unitid { id }
          factor
        }
      }
    }
  }
`;

export const GET_STOCK_ADJUSTMENT_BY_ID = gql`
  query GetStockAdjustmentById($id: ID!, $adminId: ID, $branchId: ID) {
    getStockAdjustmentById(id: $id, adminId: $adminId, branchId: $branchId) {
      id
      vouchernumber
      adjustmentdate
      type
      reason
      totalamount
      createdby_id
      createdby_name
      createdby_type
      status
      items {
        productid {
          id
          name
        }
        variantid
        quantity
        rate
        amount
      }
    }
  }
`;

// One page of the Stock Adjustments list (same fields as GET_STOCK_ADJUSTMENTS_LIST).
export const GET_STOCK_ADJUSTMENTS_PAGE = gql`
  query GetStockAdjustmentsPage(
    $filter: StockAdjustmentFilterInput
    $page: Int
    $pageSize: Int
    $search: String
    $columnFilters: [ColumnFilter!]
  ) {
    getStockAdjustmentsPage(filter: $filter, page: $page, pageSize: $pageSize, search: $search, columnFilters: $columnFilters) {
      total
      items {
        id
        vouchernumber
        adjustmentdate
        type
        reason
        totalamount
        createdby_name
        status
      }
    }
  }
`;
