import { gql } from '@apollo/client';

export const ADD_SUBCATEGORY = gql`
  mutation AddSubCategory($input: SubCategoryInput!) {
    addSubCategory(input: $input) {
      id
      subcategoryname
      status
      category {
        id
        categoryname
      }
      admin {
        id
        name
        email
      }
    }
  }
`;

export const EDIT_SUBCATEGORY = gql`
  mutation EditSubCategory($id: ID!, $input: SubCategoryInput!) {
    editSubCategory(id: $id, input: $input) {
      id
      subcategoryname
      status
      category {
        id
        categoryname
      }
      admin {
        id
        name
        email
      }
    }
  }
`;

export const DELETE_SUBCATEGORY = gql`
  mutation DeleteSubCategory($id: ID!) {
    deleteSubCategory(id: $id)
  }
`;

export const RESET_SUBCATEGORY = gql`
  mutation ResetSubCategory($id: ID!) {
    resetSubCategory(id: $id)
  }
`;
