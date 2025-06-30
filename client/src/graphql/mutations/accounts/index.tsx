// src/mutations/accounts.ts
import { gql } from '@apollo/client';

export const ADD_ACCOUNT = gql`
  mutation AddAccount($input: AccountInput!) {
    addAccount(input: $input) {
      id
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

export const EDIT_ACCOUNT = gql`
  mutation EditAccount($id: ID!, $input: AccountInput!) {
    editAccount(id: $id, input: $input) {
      id
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

export const DELETE_ACCOUNT = gql`
  mutation DeleteAccount($id: ID!) {
    deleteAccount(id: $id)
  }
`;

export const RESET_ACCOUNT = gql`
  mutation ResetAccount($id: ID!) {
    resetAccount(id: $id)
  }
`;
