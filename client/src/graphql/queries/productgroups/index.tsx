// src/queries/productgroups.ts
import { gql } from '@apollo/client';

export const GET_PRODUCTGROUPS = gql`
  query GetProductGroups($adminId: ID) {
    getProductGroups(adminId: $adminId) {
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
  query GetDeletedProductGroups($adminId: ID) {
    getDeletedProductGroups(adminId: $adminId) {
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
  query GetProductGroupById($id: ID!, $adminId: ID) {
    getProductGroupById(id: $id, adminId: $adminId) {
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

