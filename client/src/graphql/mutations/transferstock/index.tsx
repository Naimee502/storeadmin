import { gql } from '@apollo/client';

const TRANSFER_STOCK_RETURN_FIELDS = `
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
  createdby_name
  admin { id name email }
`;

export const ADD_TRANSFER_STOCK = gql`
  mutation AddTransferStock($input: TransferStockInput!) {
    addTransferStock(input: $input) {
      ${TRANSFER_STOCK_RETURN_FIELDS}
    }
  }
`;

export const EDIT_TRANSFER_STOCK = gql`
  mutation EditTransferStock($id: ID!, $input: TransferStockInput!) {
    editTransferStock(id: $id, input: $input) {
      ${TRANSFER_STOCK_RETURN_FIELDS}
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
