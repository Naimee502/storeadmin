import { gql } from '@apollo/client';

export const GET_MODELS = gql`
  query GetModels {
    getModels {
      id
      modelcode
      modelname
      status
    }
  }
`;

export const GET_MODEL_BY_ID = gql`
  query GetModelById($id: ID!) {
    getModelById(id: $id) {
      id
      modelcode
      modelname
      status
    }
  }
`;
