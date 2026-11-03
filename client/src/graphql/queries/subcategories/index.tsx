import { gql } from '@apollo/client';

export const GET_SUBCATEGORIES = gql`
  query GetSubCategories($adminId: ID, $categoryId: ID) {
    getSubCategories(adminId: $adminId, categoryId: $categoryId) {
      id
      subcategorycode
      subcategoryname
      image
      status
      sortorder
      category {
        id
        categorycode
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

// Sub Categories list page: grid columns plus what the inline edit form and
// Rearrange read from a row (image, category id). Same root field/args as
// GET_SUBCATEGORIES, so both share the normalized cache list.
export const GET_SUBCATEGORIES_LIST = gql`
  query GetSubCategoriesList($adminId: ID, $categoryId: ID) {
    getSubCategories(adminId: $adminId, categoryId: $categoryId) {
      id
      subcategorycode
      subcategoryname
      image
      status
      category {
        id
        categorycode
        categoryname
      }
    }
  }
`;

export const GET_DELETED_SUBCATEGORIES = gql`
  query GetDeletedSubCategories($adminId: ID, $categoryId: ID) {
    getDeletedSubCategories(adminId: $adminId, categoryId: $categoryId) {
      id
      subcategorycode
      subcategoryname
      image
      status
      category {
        id
        categorycode
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

export const GET_SUBCATEGORY_BY_ID = gql`
  query GetSubCategoryById($id: ID!, $adminId: ID) {
    getSubCategoryById(id: $id, adminId: $adminId) {
      id
      subcategorycode
      subcategoryname
      image
      status
      category {
        id
        categorycode
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
