// queries/units.ts
import { gql } from '@apollo/client';

export const GET_UNITS = gql`
  query GetUnits {
    getUnits {
      id
      unitcode
      unitname
      status
    }
  }
`;

export const GET_DELETED_UNITS = gql`
  query GetDeletedUnits {
    getDeletedUnits {
      id
      unitcode
      unitname
      status
    }
  }
`;

export const GET_UNIT_BY_ID = gql`
  query GetUnitById($id: ID!) {
    getUnitById(id: $id) {
      id
      unitcode
      unitname
      status
    }
  }
`;
