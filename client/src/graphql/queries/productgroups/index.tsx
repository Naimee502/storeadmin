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

// Product Groups list page: grid + inline-form fields; shares the cache with GET_PRODUCTGROUPS.
export const GET_PRODUCTGROUPS_LIST = gql`
  query GetProductGroupsList($adminId: ID) {
    getProductGroups(adminId: $adminId) {
      id
      productgroupcode
      productgroupname
      status
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

// Product Groups list page: one server page with search and column filters.
export const GET_PRODUCTGROUPS_PAGE = gql`
  query GetProductGroupsPage(
    $adminId: ID
    $page: Int
    $pageSize: Int
    $search: String
    $columnFilters: [ColumnFilter!]
  ) {
    getProductGroupsPage(adminId: $adminId, page: $page, pageSize: $pageSize, search: $search, columnFilters: $columnFilters) {
      total
      items {
        id
        productgroupcode
        productgroupname
        status
      }
    }
  }
`;
