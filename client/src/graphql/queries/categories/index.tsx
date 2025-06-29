import { gql } from '@apollo/client';

export const GET_CATEGORIES = gql`
  query GetCategories($adminId: ID) {
    getCategories(adminId: $adminId) {
      id
      categorycode
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

export const GET_DELETED_CATEGORIES = gql`
  query GetDeletedCategories($adminId: ID) {
    getDeletedCategories(adminId: $adminId) {
      id
      categorycode
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

export const GET_CATEGORY_BY_ID = gql`
  query GetCategoryById($id: ID!, $adminId: ID) {
    getCategoryById(id: $id, adminId: $adminId) {
      id
      categorycode
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

