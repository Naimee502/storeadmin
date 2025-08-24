import { gql } from '@apollo/client';

export const GET_SUBCATEGORIES = gql`
  query GetSubCategories($adminId: ID, $categoryId: ID) {
    getSubCategories(adminId: $adminId, categoryId: $categoryId) {
      id
      subcategorycode
      subcategoryname
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

export const GET_DELETED_SUBCATEGORIES = gql`
  query GetDeletedSubCategories($adminId: ID, $categoryId: ID) {
    getDeletedSubCategories(adminId: $adminId, categoryId: $categoryId) {
      id
      subcategorycode
      subcategoryname
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
