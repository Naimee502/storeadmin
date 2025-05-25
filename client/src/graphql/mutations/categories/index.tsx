// mutations/categories.ts
import { gql } from '@apollo/client';

export const ADD_CATEGORY = gql`
  mutation AddCategory($input: CategoryInput!) {
    addCategory(input: $input) {
      id
      categoryname
      status
    }
  }
`;

export const EDIT_CATEGORY = gql`
  mutation EditCategory($id: ID!, $input: CategoryInput!) {
    editCategory(id: $id, input: $input) {
      id
      categoryname
      status
    }
  }
`;

export const DELETE_CATEGORY = gql`
  mutation DeleteCategory($id: ID!) {
    deleteCategory(id: $id)
  }
`;
