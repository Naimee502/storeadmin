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

// Account Ledgers list page: grid + inline-form fields; shares the cache with GET_ACCOUNTLEDGERS.
export const GET_ACCOUNTLEDGERS_LIST = gql`
  query GetAccountLedgersList($adminId: ID) {
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

// Account Ledgers list page: one server page with search and column filters.
export const GET_ACCOUNTLEDGERS_PAGE = gql`
  query GetAccountLedgersPage(
    $adminId: ID
    $page: Int
    $pageSize: Int
    $search: String
    $columnFilters: [ColumnFilter!]
  ) {
    getAccountLedgersPage(adminId: $adminId, page: $page, pageSize: $pageSize, search: $search, columnFilters: $columnFilters) {
      total
      items {
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
      }
    }
  }
`;
