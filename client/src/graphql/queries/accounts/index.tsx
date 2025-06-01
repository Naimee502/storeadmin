// src/queries/accounts.ts
import { gql } from '@apollo/client';

export const GET_ACCOUNTS = gql`
  query GetAccounts($branchid: String) {
    getAccounts(branchid: $branchid) {
      id
      accountcode
      name
      accountgroupid
      mobile
      email
      address
      city
      pincode
      status
      branchid
    }
  }
`;

export const GET_DELETED_ACCOUNTS = gql`
  query GetDeletedAccounts($branchid: String) {
    getDeletedAccounts(branchid: $branchid) {
      id
      accountcode
      name
      accountgroupid
      mobile
      email
      address
      city
      pincode
      status
      branchid
    }
  }
`;

export const GET_ACCOUNT_BY_ID = gql`
  query GetAccountById($id: ID!) {
    getAccountById(id: $id) {
      id
      accountcode
      name
      accountgroupid
      mobile
      email
      address
      city
      pincode
      status
      branchid
    }
  }
`;
