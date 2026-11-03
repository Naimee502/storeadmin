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

// Lite list query for the Stock Adjustments list page (/stockadjustments).
// Same root field and arguments as GET_STOCK_ADJUSTMENTS, only the columns the
// table shows plus the id its edit/delete actions use. Deleted entries and the
// product report keep using the full query.
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

// Product picker for the Stock Adjustment add/edit form. Same root field and
// arguments as GET_PRODUCT_SERVICES, but only what the form reads: product
// id/name and, per variant, id/name (variant select), currentstock (Sys. Stock)
// and purchaserate (default Rate). The full query drags serials, unit prices,
// ledgers, SEO and service variants for every product.
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
