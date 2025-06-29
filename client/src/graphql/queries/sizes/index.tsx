import { gql } from '@apollo/client';

export const GET_SIZES = gql`
  query GetSizes($adminId: ID) {
    getSizes(adminId: $adminId) {
      id
      sizecode
      sizename
      status
      admin {
        id
        name
        email
      }
    }
  }
`;

export const GET_DELETED_SIZES = gql`
  query GetDeletedSizes($adminId: ID) {
    getDeletedSizes(adminId: $adminId) {
      id
      sizecode
      sizename
      status
      admin {
        id
        name
        email
      }
    }
  }
`;

export const GET_SIZE_BY_ID = gql`
  query GetSizeById($id: ID!, $adminId: ID) {
    getSizeById(id: $id, adminId: $adminId) {
      id
      sizecode
      sizename
      status
      admin {
        id
        name
        email
      }
    }
  }
`;
