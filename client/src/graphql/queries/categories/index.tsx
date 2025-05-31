// queries/categories.ts
import { gql } from '@apollo/client';

export const GET_CATEGORIES = gql`
  query GetCategories {
    getCategories {
      id
      categorycode
      categoryname
      status
    }
  }
`;

export const GET_DELETED_CATEGORIES = gql`
  query GetDeletedCategories {
    getDeletedCategories {
      id
      categorycode
      categoryname
      status
    }
  }
`;

export const GET_CATEGORY_BY_ID = gql`
  query GetCategoryById($id: ID!) {
    getCategoryById(id: $id) {
      id
      categorycode
      categoryname
      status
    }
  }
`;
