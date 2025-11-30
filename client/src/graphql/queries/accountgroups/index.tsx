import { gql } from '@apollo/client';

export const GET_ACCOUNTGROUPS = gql`
  query GetAccountGroups($adminId: ID) {
    getAccountGroups(adminId: $adminId) {
      id
      accountgroupcode
      accountgroupname
      category
      status
      admin {
        id
        name
        email
      }
    }
  }
`;

export const GET_DELETED_ACCOUNTGROUPS = gql`
  query GetDeletedAccountGroups($adminId: ID) {
    getDeletedAccountGroups(adminId: $adminId) {
      id
      accountgroupcode
      accountgroupname
      category
      status
      admin {
        id
        name
        email
      }
    }
  }
`;

export const GET_ACCOUNTGROUP_BY_ID = gql`
  query GetAccountGroupById($id: ID!) {
    getAccountGroupById(id: $id) {
      id
      accountgroupcode
      accountgroupname
      category
      status
      admin {
        id
        name
        email
      }
    }
  }
`;
