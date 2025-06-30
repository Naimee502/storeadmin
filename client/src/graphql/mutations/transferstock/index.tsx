// mutations/transferStock.ts
import { gql } from '@apollo/client';

export const ADD_TRANSFER_STOCK = gql`
  mutation AddTransferStock($input: TransferStockInput!) {
    addTransferStock(input: $input) {
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

export const EDIT_TRANSFER_STOCK = gql`
  mutation EditTransferStock($id: ID!, $input: TransferStockInput!) {
    editTransferStock(id: $id, input: $input) {
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

export const DELETE_TRANSFER_STOCK = gql`
  mutation DeleteTransferStock($id: ID!) {
    deleteTransferStock(id: $id)
  }
`;

export const RESET_TRANSFER_STOCK = gql`
  mutation ResetTransferStock($id: ID!) {
    resetTransferStock(id: $id)
  }
`;
