import { gql } from '@apollo/client';

export const ADD_SALESMAN = gql`
  mutation AddSalesman($input: SalesmenAccountInput!) {
    addSalesmanAccount(input: $input) {
      id
      name
      mobile
      email
      password
      profilepicture
      address
      commission
      status
    }
  }
`;

export const EDIT_SALESMAN = gql`
  mutation EditSalesman($id: ID!, $input: SalesmenAccountInput!) {
    editSalesmanAccount(id: $id, input: $input) {
      id
      name
      mobile
      email
      password
      profilepicture
      address
      commission
      status
    }
  }
`;

export const DELETE_SALESMAN = gql`
  mutation DeleteSalesman($id: ID!) {
    deleteSalesmanAccount(id: $id)
  }
`;

export const RESET_SALESMAN = gql`
  mutation ResetSalesman($id: ID!) {
    resetSalesmanAccount(id: $id)
  }
`;
