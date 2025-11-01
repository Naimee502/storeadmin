import { gql } from '@apollo/client';

export const ADD_ACCOUNTLEDGER = gql`
  mutation AddAccountLedger($input: AccountLedgerInput!) {
    addAccountLedger(input: $input) {
      id
      ledgername
      accountgroupid {
        id
        accountgroupname
      }
      ledgertype
      openingbalance
      openingbalancetype
      status
      admin {
        id
        name
      }
      branchid {
        id
        branchname
      }
    }
  }
`;

export const EDIT_ACCOUNTLEDGER = gql`
  mutation EditAccountLedger($id: ID!, $input: AccountLedgerInput!) {
    editAccountLedger(id: $id, input: $input) {
      id
      ledgername
      accountgroupid {
        id
        accountgroupname
      }
      ledgertype
      openingbalance
      openingbalancetype
      status
      admin {
        id
        name
      }
      branchid {
        id
        branchname
      }
    }
  }
`;

export const DELETE_ACCOUNTLEDGER = gql`
  mutation DeleteAccountLedger($id: ID!) {
    deleteAccountLedger(id: $id)
  }
`;

export const RESET_ACCOUNTLEDGER = gql`
  mutation ResetAccountLedger($id: ID!) {
    resetAccountLedger(id: $id)
  }
`;
