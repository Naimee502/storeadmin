import { gql } from '@apollo/client';

export const GET_BRANDS = gql`
  query GetBrands($adminId: ID) {
    getBrands(adminId: $adminId) {
      id
      brandcode
      brandname
      status
      admin {
        id
        name
        email
      }
    }
  }
`;

export const GET_DELETED_BRANDS = gql`
  query GetDeletedBrands($adminId: ID) {
    getDeletedBrands(adminId: $adminId) {
      id
      brandcode
      brandname
      status
      admin {
        id
        name
        email
      }
    }
  }
`;

export const GET_BRAND_BY_ID = gql`
  query GetBrandById($id: ID!, $adminId: ID) {
    getBrandById(id: $id, adminId: $adminId) {
      id
      brandcode
      brandname
      status
      admin {
        id
        name
        email
      }
    }
  }
`;
