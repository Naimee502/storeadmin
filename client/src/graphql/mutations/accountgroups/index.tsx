// src/mutations/accountgroups.ts
import { gql } from '@apollo/client';

export const ADD_ACCOUNTGROUP = gql`
  mutation AddAccountGroup($input: AccountGroupInput!) {
    addAccountGroup(input: $input) {
      id
      accountgroupname
      status
    }
  }
`;

export const EDIT_ACCOUNTGROUP = gql`
  mutation EditAccountGroup($id: ID!, $input: AccountGroupInput!) {
    editAccountGroup(id: $id, input: $input) {
      id
      accountgroupname
      status
    }
  }
`;

export const DELETE_ACCOUNTGROUP = gql`
  mutation DeleteAccountGroup($id: ID!) {
    deleteAccountGroup(id: $id)
  }
`;

export const RESET_ACCOUNTGROUP = gql`
  mutation ResetAccountGroup($id: ID!) {
    resetAccountGroup(id: $id)
  }
`;
