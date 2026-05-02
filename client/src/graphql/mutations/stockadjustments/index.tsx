import { gql } from "@apollo/client";

export const CREATE_STOCK_ADJUSTMENT = gql`
  mutation CreateStockAdjustment($input: StockAdjustmentInput!) {
    createStockAdjustment(input: $input) {
      id
      vouchernumber
      status
    }
  }
`;

export const UPDATE_STOCK_ADJUSTMENT = gql`
  mutation UpdateStockAdjustment($id: ID!, $input: StockAdjustmentUpdateInput!) {
    updateStockAdjustment(id: $id, input: $input) {
      id
      vouchernumber
      status
    }
  }
`;

export const DELETE_STOCK_ADJUSTMENT = gql`
  mutation DeleteStockAdjustment($id: ID!) {
    deleteStockAdjustment(id: $id)
  }
`;

export const CANCEL_STOCK_ADJUSTMENT = gql`
  mutation CancelStockAdjustment($id: ID!) {
    cancelStockAdjustment(id: $id)
  }
`;

export const RESET_STOCK_ADJUSTMENT = gql`
  mutation ResetStockAdjustment($id: ID!) {
    resetStockAdjustment(id: $id)
  }
`;
