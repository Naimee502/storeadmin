import { gql } from '@apollo/client';

export const GET_SIZES = gql`
  query GetSizes($adminId: ID) {
    getSizes(adminId: $adminId) {
      id
      sizecode
      sizename
      status
      admin {
        id
        name
        email
      }
    }
  }
`;

// Sizes list page: grid columns plus what the inline edit form reads from a
// row (no admin ref). Same root field/args as GET_SIZES, so both share the
// normalized cache list.
export const GET_SIZES_LIST = gql`
  query GetSizesList($adminId: ID) {
    getSizes(adminId: $adminId) {
      id
      sizecode
      sizename
      status
    }
  }
`;

export const GET_DELETED_SIZES = gql`
  query GetDeletedSizes($adminId: ID) {
    getDeletedSizes(adminId: $adminId) {
      id
      sizecode
      sizename
      status
      admin {
        id
        name
        email
      }
    }
  }
`;

export const GET_SIZE_BY_ID = gql`
  query GetSizeById($id: ID!, $adminId: ID) {
    getSizeById(id: $id, adminId: $adminId) {
      id
      sizecode
      sizename
      status
      admin {
        id
        name
        email
      }
    }
  }
`;

// Sizes list page: one server page with search and column filters.
export const GET_SIZES_PAGE = gql`
  query GetSizesPage(
    $adminId: ID
    $page: Int
    $pageSize: Int
    $search: String
    $columnFilters: [ColumnFilter!]
  ) {
    getSizesPage(adminId: $adminId, page: $page, pageSize: $pageSize, search: $search, columnFilters: $columnFilters) {
      total
      items {
        id
        sizecode
        sizename
        status
      }
    }
  }
`;
