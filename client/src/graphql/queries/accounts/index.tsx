// src/queries/accounts.ts
import { gql } from '@apollo/client';

export const GET_ACCOUNTS = gql`
  query GetAccounts($filter: AccountFilterInput) {
    getAccounts(filter: $filter) {
      id
      accountcode
      name
      type
      accounttype
      accountgroupid {
        id
        accountgroupname
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
      isposcustomer
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
      name
      type
      accounttype
      accountgroupid {
        id
        accountgroupname
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
      isposcustomer
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
      createdAt
      updatedAt
    }
  }
`;
