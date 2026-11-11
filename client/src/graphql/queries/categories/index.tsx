import { gql } from '@apollo/client';

export const GET_CATEGORIES = gql`
  query GetCategories($adminId: ID) {
    getCategories(adminId: $adminId) {
      id
      categorycode
      categoryname
      image
      status
      sortorder
      specdefs { key label type options print required }
      admin {
        id
        name
        email
      }
    }
  }
`;

// Categories list page: grid + inline-form fields; shares the cache with GET_CATEGORIES.
export const GET_CATEGORIES_LIST = gql`
  query GetCategoriesList($adminId: ID) {
    getCategories(adminId: $adminId) {
      id
      categorycode
      categoryname
      image
      status
      specdefs { key label type options print required }
    }
  }
`;

export const GET_DELETED_CATEGORIES = gql`
  query GetDeletedCategories($adminId: ID) {
    getDeletedCategories(adminId: $adminId) {
      id
      categorycode
      categoryname
      image
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
      image
      status
      admin {
        id
        name
        email
      }
    }
  }
`;

