// src/queries/productgroups.ts
import { gql } from '@apollo/client';

export const GET_PRODUCTGROUPS = gql`
  query GetProductGroups {
    getProductGroups {
      id
      productgroupcode
      productgroupname
      status
      admin {
        id
        name
        email
      }
    }
  }
`;

export const GET_DELETED_PRODUCTGROUPS = gql`
  query GetDeletedProductGroups {
    getDeletedProductGroups {
      id
      productgroupcode
      productgroupname
      status
      admin {
        id
        name
        email
      }
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
      admin {
        id
        name
        email
      }
    }
  }
`;
