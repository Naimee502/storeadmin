// src/mutations/productgroups.ts
import { gql } from '@apollo/client';

export const ADD_PRODUCTGROUP = gql`
  mutation AddProductGroup($input: ProductGroupInput!) {
    addProductGroup(input: $input) {
      id
      productgroupname
      status
    }
  }
`;

export const EDIT_PRODUCTGROUP = gql`
  mutation EditProductGroup($id: ID!, $input: ProductGroupInput!) {
    editProductGroup(id: $id, input: $input) {
      id
      productgroupname
      status
    }
  }
`;

export const DELETE_PRODUCTGROUP = gql`
  mutation DeleteProductGroup($id: ID!) {
    deleteProductGroup(id: $id)
  }
`;

export const RESET_PRODUCTGROUP = gql`
  mutation ResetProductGroup($id: ID!) {
    resetProductGroup(id: $id)
  }
`;
