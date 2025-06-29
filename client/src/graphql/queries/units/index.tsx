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

