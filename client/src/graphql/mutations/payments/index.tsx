import { gql } from "@apollo/client";

export const ADD_PAYMENT = gql`
  mutation AddPayment($input: PaymentInput!) {
    addPayment(input: $input) {
      id
      paymentcode
      paymentdate
      type
      mode
      partyid {
        id
        name
      }
      ledgerid {
        id
        ledgername
      }
      amount
      transactionid
      status
      createdAt
      updatedAt
    }
  }
`;

export const EDIT_PAYMENT = gql`
  mutation EditPayment($id: ID!, $input: PaymentInput!) {
    editPayment(id: $id, input: $input) {
      id
      paymentcode
      paymentdate
      type
      mode
      partyid {
        id
        name
      }
      ledgerid {
        id
        ledgername
      }
      amount
      transactionid
      status
      createdAt
      updatedAt
    }
  }
`;

export const DELETE_PAYMENT = gql`
  mutation DeletePayment($id: ID!) {
    deletePayment(id: $id)
  }
`;

export const RESET_PAYMENT = gql`
  mutation ResetPayment($id: ID!) {
    resetPayment(id: $id)
  }
`;