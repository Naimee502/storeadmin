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
