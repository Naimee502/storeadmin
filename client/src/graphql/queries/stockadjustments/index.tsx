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
      status
      createdAt
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
