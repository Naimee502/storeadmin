// src/queries/accounts.ts
import { gql } from '@apollo/client';

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
      outstanding
    }
  }
`;
