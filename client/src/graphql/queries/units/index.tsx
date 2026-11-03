// queries/units.ts
import { gql } from '@apollo/client';

export const GET_UNITS = gql`
  query GetUnits($adminId: ID) {
    getUnits(adminId: $adminId) {
      id
      unitcode
      unitname
      status
      admin {
        id
        name
        email
      }
    }
  }
`;

// Units list page: grid columns plus what the inline edit form reads from a
// row. Same root field/args as GET_UNITS, so both share the normalized cache list.
export const GET_UNITS_LIST = gql`
  query GetUnitsList($adminId: ID) {
    getUnits(adminId: $adminId) {
      id
      unitcode
      unitname
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
      status
      admin {
        id
        name
        email
      }
    }
  }
`;

