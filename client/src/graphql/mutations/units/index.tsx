// mutations/units.ts
import { gql } from '@apollo/client';

export const ADD_UNIT = gql`
  mutation AddUnit($input: UnitInput!) {
    addUnit(input: $input) {
      id
      unitname
      status
    }
  }
`;

export const EDIT_UNIT = gql`
  mutation EditUnit($id: ID!, $input: UnitInput!) {
    editUnit(id: $id, input: $input) {
      id
      unitname
      status
    }
  }
`;

export const DELETE_UNIT = gql`
  mutation DeleteUnit($id: ID!) {
    deleteUnit(id: $id)
  }
`;

export const RESET_UNIT = gql`
  mutation ResetUnit($id: ID!) {
    resetUnit(id: $id)
  }
`;
