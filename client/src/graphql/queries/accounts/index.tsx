// src/queries/accounts.ts
import { gql } from '@apollo/client';

// Dropdown / label query: just what the party pickers and the payment list
// read (label = name - mobile - city, customer/vendor type, GST state, price
// list channel/region, ledger link + opening for the payment form). The full
// GET_ACCOUNTS (bank details, OTP, coordinates, images…) stays for the
// Party Accounts screens.
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

// Party Accounts list grid: the columns (code, name, mobile, ledger, type,
// channel, parent party, city, status/approval), the Email export column and
// the sub-party toggle (assignaccountid). A few cheap scalars (GST, state,
// pincode, region, address) stay so the grid's free-text search still finds a
// party by them. View/Edit fetch the full record by id, so bank details, OTP,
// coordinates, images, admin/branch/group/salesman refs are left out.
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

/**
 * Party list "Outstanding" column. Kept out of GET_ACCOUNTS on purpose — the
 * figure walks every invoice, payment, journal and return, so only the screen
 * that shows the column pays for it.
 */
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
