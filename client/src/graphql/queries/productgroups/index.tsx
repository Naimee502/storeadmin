// src/queries/productgroups.ts
import { gql } from '@apollo/client';

export const GET_PRODUCTGROUPS = gql`
  query GetProductGroups {
    getProductGroups {
      id
      productgroupcode
      productgroupname
      status
    }
  }
`;

export const GET_PRODUCTGROUP_BY_ID = gql`
  query GetProductGroupById($id: ID!) {
    getProductGroupById(id: $id) {
      id
      productgroupcode
      productgroupname
      status
    }
  }
`;
