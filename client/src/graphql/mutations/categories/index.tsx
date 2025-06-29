import { gql } from '@apollo/client';

export const ADD_CATEGORY = gql`
  mutation AddCategory($input: CategoryInput!) {
    addCategory(input: $input) {
      id
      categoryname
      status
      admin {
        id
        name
        email
      }
    }
  }
`;

export const EDIT_CATEGORY = gql`
  mutation EditCategory($id: ID!, $input: CategoryInput!) {
    editCategory(id: $id, input: $input) {
      id
      categoryname
      status
      admin {
        id
        name
        email
      }
    }
  }
`;

export const DELETE_CATEGORY = gql`
  mutation DeleteCategory($id: ID!) {
    deleteCategory(id: $id)
  }
`;

export const RESET_CATEGORY = gql`
  mutation ResetCategory($id: ID!) {
    resetCategory(id: $id)
  }
`;
