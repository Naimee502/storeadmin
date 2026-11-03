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

// Account Groups list page (and the Account Ledgers page's group picker):
// the grid columns plus what the inline edit form reads from a row. Same root
// field/args as GET_ACCOUNTGROUPS, so both share the normalized cache list.
export const GET_ACCOUNTGROUPS_LIST = gql`
  query GetAccountGroupsList($adminId: ID) {
    getAccountGroups(adminId: $adminId) {
      id
      accountgroupcode
      accountgroupname
      category
      status
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
