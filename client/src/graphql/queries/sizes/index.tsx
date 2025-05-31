// queries/sizes.ts
import { gql } from '@apollo/client';

export const GET_SIZES = gql`
  query GetSizes {
    getSizes {
      id
      sizecode
      sizename
      status
    }
  }
`;

export const GET_DELETED_SIZES = gql`
  query GetDeletedSizes {
    getDeletedSizes {
      id
      sizecode
      sizename
      status
    }
  }
`;

export const GET_SIZE_BY_ID = gql`
  query GetSizeById($id: ID!) {
    getSizeById(id: $id) {
      id
      sizecode
      sizename
      status
    }
  }
`;
