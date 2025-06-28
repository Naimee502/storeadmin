// queries/transferStock.ts
import { gql } from '@apollo/client';

export const GET_TRANSFER_STOCKS = gql`
  query GetTransferStocks($frombranchid: ID) {
    getTransferStocks(frombranchid: $frombranchid) {
      id
      frombranchid
      tobranchid
      productid
      transferqty
      transferdate
      status
    }
  }
`;

export const GET_DELETED_TRANSFER_STOCKS = gql`
  query GetDeletedTransferStocks($frombranchid: ID) {
    getDeletedTransferStocks(frombranchid: $frombranchid) {
      id
      frombranchid
      tobranchid
      productid
      transferqty
      transferdate
      status
    }
  }
`;

export const GET_TRANSFER_STOCK_BY_ID = gql`
  query GetTransferStockById($id: ID!) {
    getTransferStockById(id: $id) {
      id
      frombranchid
      tobranchid
      productid
      transferqty
      transferdate
      status
    }
  }
`;
