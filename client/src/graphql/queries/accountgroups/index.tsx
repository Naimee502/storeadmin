import { gql } from '@apollo/client';

export const GET_ACCOUNTGROUPS = gql`
  query GetAccountGroups {
    getAccountGroups {
      id
      accountgroupcode
      accountgroupname
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
  query GetDeletedAccountGroups {
    getDeletedAccountGroups {
      id
      accountgroupcode
      accountgroupname
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
      status
      admin {
        id
        name
        email
      }
    }
  }
`;
