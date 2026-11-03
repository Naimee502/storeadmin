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
      admin {
        id
        name
        email
      }
    }
  }
`;

// Categories list page (and the Sub Categories page's category picker /
// grouping order): grid columns plus what the inline edit form reads from a
// row (image). Same root field/args as GET_CATEGORIES, so both share the
// normalized cache list.
export const GET_CATEGORIES_LIST = gql`
  query GetCategoriesList($adminId: ID) {
    getCategories(adminId: $adminId) {
      id
      categorycode
      categoryname
      image
      status
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

