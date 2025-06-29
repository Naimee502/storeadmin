import { gql } from '@apollo/client';

export const ADD_BRAND = gql`
  mutation AddBrand($input: BrandInput!) {
    addBrand(input: $input) {
      id
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

export const EDIT_BRAND = gql`
  mutation EditBrand($id: ID!, $input: BrandInput!) {
    editBrand(id: $id, input: $input) {
      id
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

export const DELETE_BRAND = gql`
  mutation DeleteBrand($id: ID!) {
    deleteBrand(id: $id)
  }
`;

export const RESET_BRAND = gql`
  mutation ResetBrand($id: ID!) {
    resetBrand(id: $id)
  }
`;
