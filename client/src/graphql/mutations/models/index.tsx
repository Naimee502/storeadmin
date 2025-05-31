import { gql } from '@apollo/client';

export const ADD_MODEL = gql`
  mutation AddModel($input: ModelInput!) {
    addModel(input: $input) {
      id
      modelname
      status
    }
  }
`;

export const EDIT_MODEL = gql`
  mutation EditModel($id: ID!, $input: ModelInput!) {
    editModel(id: $id, input: $input) {
      id
      modelname
      status
    }
  }
`;

export const DELETE_MODEL = gql`
  mutation DeleteModel($id: ID!) {
    deleteModel(id: $id)
  }
`;

export const RESET_MODEL = gql`
  mutation ResetModel($id: ID!) {
    resetModel(id: $id)
  }
`;
