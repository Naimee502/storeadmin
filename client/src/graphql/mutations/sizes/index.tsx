// mutations/sizes.ts
import { gql } from '@apollo/client';

export const ADD_SIZE = gql`
  mutation AddSize($input: SizeInput!) {
    addSize(input: $input) {
      id
      sizename
      status
    }
  }
`;

export const EDIT_SIZE = gql`
  mutation EditSize($id: ID!, $input: SizeInput!) {
    editSize(id: $id, input: $input) {
      id
      sizename
      status
    }
  }
`;

export const DELETE_SIZE = gql`
  mutation DeleteSize($id: ID!) {
    deleteSize(id: $id)
  }
`;

export const RESET_SIZE = gql`
  mutation ResetSize($id: ID!) {
    resetSize(id: $id)
  }
`;
