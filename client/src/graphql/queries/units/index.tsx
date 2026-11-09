// queries/units.ts
import { gql } from '@apollo/client';

export const GET_UNITS = gql`
  query GetUnits($adminId: ID) {
    getUnits(adminId: $adminId) {
      id
      unitcode
      unitname
      uqc
      status
      admin {
        id
        name
        email
      }
    }
  }
`;

// Units list page: grid + inline-form fields; shares the cache with GET_UNITS.
export const GET_UNITS_LIST = gql`
  query GetUnitsList($adminId: ID) {
    getUnits(adminId: $adminId) {
      id
      unitcode
      unitname
      uqc
      status
    }
  }
`;

export const GET_DELETED_UNITS = gql`
  query GetDeletedUnits($adminId: ID) {
    getDeletedUnits(adminId: $adminId) {
      id
      unitcode
      unitname
      uqc
      status
      admin {
        id
        name
        email
      }
    }
  }
`;

export const GET_UNIT_BY_ID = gql`
  query GetUnitById($id: ID!, $adminId: ID) {
    getUnitById(id: $id, adminId: $adminId) {
      id
      unitcode
      unitname
      uqc
      status
      admin {
        id
        name
        email
      }
    }
  }
`;

// Units list page: one server page with search and column filters.
export const GET_UNITS_PAGE = gql`
  query GetUnitsPage(
    $adminId: ID
    $page: Int
    $pageSize: Int
    $search: String
    $columnFilters: [ColumnFilter!]
  ) {
    getUnitsPage(adminId: $adminId, page: $page, pageSize: $pageSize, search: $search, columnFilters: $columnFilters) {
      total
      items {
        id
        unitcode
        unitname
        uqc
        status
      }
    }
  }
`;
