// queries/transferStock.ts
import { gql } from '@apollo/client';

export const GET_TRANSFER_STOCKS = gql`
  query GetTransferStocks($adminId: ID, $frombranchid: ID) {
    getTransferStocks(adminId: $adminId, frombranchid: $frombranchid) {
      id
      frombranchid
      tobranchid
      productid
      transferqty
      transferdate
      status
      admin {
        id
        name
        email
      }
    }
  }
`;

export const GET_DELETED_TRANSFER_STOCKS = gql`
  query GetDeletedTransferStocks($adminId: ID, $frombranchid: ID) {
    getDeletedTransferStocks(adminId: $adminId, frombranchid: $frombranchid) {
      id
      frombranchid
      tobranchid
      productid
      transferqty
      transferdate
      status
      admin {
        id
        name
        email
      }
    }
  }
`;

export const GET_TRANSFER_STOCK_BY_ID = gql`
  query GetTransferStockById($id: ID!, $adminId: ID) {
    getTransferStockById(id: $id, adminId: $adminId) {
      id
      frombranchid
      tobranchid
      productid
      transferqty
      transferdate
      status
      admin {
        id
        name
        email
      }
    }
  }
`;
