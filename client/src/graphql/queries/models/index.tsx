import { gql } from '@apollo/client';

export const GET_MODELS = gql`
  query GetModels($adminId: ID) {
    getModels(adminId: $adminId) {
      id
      modelcode
      modelname
      status
      admin {
        id
        name
        email
      }
    }
  }
`;

export const GET_DELETED_MODELS = gql`
  query GetDeletedModels($adminId: ID) {
    getDeletedModels(adminId: $adminId) {
      id
      modelcode
      modelname
      status
      admin {
        id
        name
        email
      }
    }
  }
`;

export const GET_MODEL_BY_ID = gql`
  query GetModelById($id: ID!, $adminId: ID) {
    getModelById(id: $id, adminId: $adminId) {
      id
      modelcode
      modelname
      status
      admin {
        id
        name
        email
      }
    }
  }
`;
