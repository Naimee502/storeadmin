import { gql } from '@apollo/client';

export const GET_ACCOUNTLEDGERS = gql`
  query GetAccountLedgers($adminId: ID) {
    getAccountLedgers(adminId: $adminId) {
      id
      ledgercode
      ledgername
      ledgertype
      openingbalance
      openingbalancetype
      status 
      accountgroupid {
        id
        accountgroupname
      }
      admin {
        id
        name
        email
      }
      branchid {
        id
        branchname
      }
    }
  }
`;

export const GET_DELETED_ACCOUNTLEDGERS = gql`
  query GetDeletedAccountLedgers($adminId: ID) {
    getDeletedAccountLedgers(adminId: $adminId) {
      id
      ledgercode
      ledgername
      ledgertype
      openingbalance
      openingbalancetype
      status
      accountgroupid {
        id
        accountgroupname
      }
      admin {
        id
        name
        email
      }
      branchid {
        id
        branchname
      }
    }
  }
`;


export const GET_ACCOUNTLEDGER_BY_ID = gql`
  query GetAccountLedgerById($id: ID!) {
    getAccountLedgerById(id: $id) {
      id
      ledgercode
      ledgername
      ledgertype
      openingbalance
      openingbalancetype
      status
      accountgroupid {
        id
        accountgroupname
      }
      admin {
        id
        name
        email
      }
      branchid {
        id
        branchname
      }
    }
  }
`;
