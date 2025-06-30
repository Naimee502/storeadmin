// src/queries/accounts.ts
import { gql } from '@apollo/client';

export const GET_ACCOUNTS = gql`
  query GetAccounts($branchid: ID, $adminId: ID) {
  getAccounts(adminId: $adminId, branchid: $branchid) {
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
      admin {
        id
        name
        email
      }
    }
  }
`;


export const GET_DELETED_ACCOUNTS = gql`
  query GetDeletedAccounts($branchid: ID, $adminId: ID) {
    getDeletedAccounts(adminId: $adminId, branchid: $branchid) {
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
      admin {
        id
        name
        email
      }
    }
  }
`;

export const GET_ACCOUNT_BY_ID = gql`
  query GetAccountById($id: ID!, $adminId: ID) {
    getAccountById(id: $id, adminId: $adminId) {
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
      admin {
        id
        name
        email
      }
    }
  }
`;
