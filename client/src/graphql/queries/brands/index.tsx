import { gql } from '@apollo/client';

export const GET_BRANDS = gql`
  query GetBrands {
    getBrands {
      id
      brandcode
      brandname
      status
    }
  }
`;

export const GET_DELETED_BRANDS = gql`
  query GetDeletedBrands {
    getDeletedBrands {
      id
      brandcode
      brandname
      status
    }
  }
`;

export const GET_BRAND_BY_ID = gql`
  query GetBrandById($id: ID!) {
    getBrandById(id: $id) {
      id
      brandcode
      brandname
      status
    }
  }
`;
