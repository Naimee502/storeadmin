import { gql } from '@apollo/client';

export const ADD_TRANSACTION = gql`
  mutation AddTransaction($input: TransactionInput!) {
    addTransaction(input: $input) {
      id
      adminid
      branchid
      entrytype
      transactiondate
      narration
      totaldebit
      totalcredit
      status
      entries {
        ledgerid {
          id
          ledgername
        }
        debit
        credit
        productserviceid
        variantid
        remarks
      }
    }
  }
`;

export const EDIT_TRANSACTION = gql`
  mutation EditTransaction($id: ID!, $input: TransactionInput!) {
    editTransaction(id: $id, input: $input) {
      id
      adminid
      branchid
      entrytype
      transactiondate
      narration
      totaldebit
      totalcredit
      status
      entries {
        ledgerid {
          id
          ledgername
        }
        debit
        credit
        productserviceid
        variantid
        remarks
      }
    }
  }
`;

export const DELETE_TRANSACTION = gql`
  mutation DeleteTransaction($id: ID!) {
    deleteTransaction(id: $id)
  }
`;

export const RESET_TRANSACTION = gql`
  mutation ResetTransaction($id: ID!) {
    resetTransaction(id: $id)
  }
`;