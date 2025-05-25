// src/queries/accountgroups.ts
import { gql } from '@apollo/client';

export const GET_ACCOUNTGROUPS = gql`
  query GetAccountGroups {
    getAccountGroups {
      id
      accountgroupcode
      accountgroupname
      status
    }
  }
`;

export const GET_ACCOUNTGROUP_BY_ID = gql`
  query GetAccountGroupById($id: ID!) {
    getAccountGroupById(id: $id) {
      id
      accountgroupcode
      accountgroupname
      status
    }
  }
`;
