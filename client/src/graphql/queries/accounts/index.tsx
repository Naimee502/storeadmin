// src/queries/accounts.ts
import { gql } from '@apollo/client';

// Lite query for party pickers and labels; full GET_ACCOUNTS stays for Party Accounts screens.
export const GET_ACCOUNTS_LITE = gql`
  query GetAccountsLite($filter: AccountFilterInput) {
    getAccounts(filter: $filter) {
      id
      name
      type
      mobile
      city
      state
      region
      gstnumber
      ledgerid {
        id
        ledgername
      }
      channel {
        id
        channelName
      }
      salesmanid {
        id
        name
      }
      openingbalance
      openingbalancetype
      status
    }
  }
`;

// Party Accounts list grid; View/Edit load the full record by id.
export const GET_ACCOUNTS_LIST = gql`
  query GetAccountsList($filter: AccountFilterInput) {
    getAccounts(filter: $filter) {
      id
      accountcode
      approvalstatus
      name
      type
      mobile
      email
      gstnumber
      address
      city
      state
      pincode
      region
      ledgerid {
        id
        ledgername
      }
      channel {
        id
        channelName
      }
      assignaccountid {
        id
        name
      }
      status
    }
  }
`;

// One page of the Party Accounts list page: same fields as GET_ACCOUNTS_LIST.
export const GET_ACCOUNTS_PAGE = gql`
  query GetAccountsPage(
    $filter: AccountFilterInput
    $page: Int
    $pageSize: Int
    $search: String
    $columnFilters: [ColumnFilter!]
    $directPartiesOnly: Boolean
  ) {
    getAccountsPage(filter: $filter, page: $page, pageSize: $pageSize, search: $search, columnFilters: $columnFilters, directPartiesOnly: $directPartiesOnly) {
      total
      subPartyCount
      items {
        id
        accountcode
        approvalstatus
        name
        type
        mobile
        email
        gstnumber
        address
        city
        state
        pincode
        region
        ledgerid {
          id
          ledgername
        }
        channel {
          id
          channelName
        }
        assignaccountid {
          id
          name
        }
        status
      }
    }
  }
`;

export const GET_ACCOUNTS = gql`
  query GetAccounts($filter: AccountFilterInput) {
    getAccounts(filter: $filter) {
      id
      accountcode
      approvalstatus
      name
      type
      accountgroupid {
        id
        accountgroupname
      }
      ledgerid {
        id
        ledgername
      }
      mobile
      email
      gstnumber
      pan
      address
      city
      state
      country
      pincode
      openingbalance
      openingbalancetype
      creditlimit
      bankname
      bankaccountnumber
      ifsc
      upiid
      billingcycle
      duedays
      latitude
      longitude
      shopimage
      otp
      assignaccountid {
        id
        name
      }
      salesmanid {
        id
        name
      }
      status
      branchid {
        id
        branchname
      }
      admin {
        id
        name
        email
      }
      channel {
        id
        channelName
      }
      region
      createdAt
      updatedAt
    }
  }
`;

export const GET_ACCOUNT_BY_ID = gql`
  query GetAccountById($id: ID!, $adminId: ID) {
    getAccountById(id: $id, adminId: $adminId) {
      id
      accountcode
      approvalstatus
      name
      type
      accountgroupid {
        id
        accountgroupname
      }
      ledgerid {
        id
        ledgername
      }
      mobile
      email
      gstnumber
      pan
      address
      city
      state
      country
      pincode
      openingbalance
      openingbalancetype
      creditlimit
      bankname
      bankaccountnumber
      ifsc
      upiid
      billingcycle
      duedays
      latitude
      longitude
      shopimage
      otp
      assignaccountid {
        id
        name
      }
      salesmanid {
        id
        name
      }
      status
      branchid {
        id
        branchname
      }
      admin {
        id
        name
        email
      }
      channel {
        id
        channelName
      }
      region
      createdAt
      updatedAt
    }
  }
`;

/** Party list "Outstanding" column; kept separate because it is expensive. */
export const GET_PARTY_OUTSTANDING_SUMMARY = gql`
  query GetPartyOutstandingSummary($filter: AccountFilterInput) {
    getPartyOutstandingSummary(filter: $filter) {
      id
      name
      mobile
      city
      outstanding
    }
  }
`;

/** GPS point → postal address (server-side, OpenStreetMap). Pre-fills a party's address. */
export const REVERSE_GEOCODE = gql`
  query ReverseGeocode($latitude: Float!, $longitude: Float!) {
    reverseGeocode(latitude: $latitude, longitude: $longitude) {
      address
      city
      state
      pincode
      country
    }
  }
`;
