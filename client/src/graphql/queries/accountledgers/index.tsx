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

// Account Ledgers list page only: the grid columns plus every field the
// inline edit form reads from a row. admin/branchid are left out. Same root
// field/args as GET_ACCOUNTLEDGERS, so both share the normalized cache list.
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
