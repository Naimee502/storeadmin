import { gql } from "@apollo/client";

export const CREATE_PRICE_LIST = gql`
  mutation CreatePriceList($input: PriceListInput!) {
    createPriceList(input: $input) {
      id
      name
    }
  }
`;

export const UPDATE_PRICE_LIST = gql`
  mutation UpdatePriceList($id: ID!, $input: PriceListInput!) {
    updatePriceList(id: $id, input: $input) {
      id
      name
    }
  }
`;

export const DELETE_PRICE_LIST = gql`
  mutation DeletePriceList($id: ID!) {
    deletePriceList(id: $id)
  }
`;

export const CREATE_PRICE_ASSIGNMENT = gql`
  mutation CreatePriceAssignment($input: PriceAssignmentInput!) {
    createPriceAssignment(input: $input) {
      id
    }
  }
`;

export const UPDATE_PRICE_ASSIGNMENT = gql`
  mutation UpdatePriceAssignment($id: ID!, $input: PriceAssignmentInput!) {
    updatePriceAssignment(id: $id, input: $input) {
      id
    }
  }
`;

export const DELETE_PRICE_ASSIGNMENT = gql`
  mutation DeletePriceAssignment($id: ID!) {
    deletePriceAssignment(id: $id)
  }
`;
