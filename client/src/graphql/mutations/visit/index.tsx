import { gql } from "@apollo/client";

export const ADD_VISIT = gql`
  mutation AddVisit($input: VisitInput!) {
    addVisit(input: $input) {
      id
    }
  }
`;

export const EDIT_VISIT = gql`
  mutation EditVisit($id: ID!, $input: VisitInput!) {
    editVisit(id: $id, input: $input) {
      id
    }
  }
`;

export const DELETE_VISIT = gql`
  mutation DeleteVisit($id: ID!) {
    deleteVisit(id: $id)
  }
`;
