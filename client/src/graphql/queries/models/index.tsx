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

// Models list page: grid + inline-form fields; shares the cache with GET_MODELS.
export const GET_MODELS_LIST = gql`
  query GetModelsList($adminId: ID) {
    getModels(adminId: $adminId) {
      id
      modelcode
      modelname
      status
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

// Models list page: one server page with search and column filters.
export const GET_MODELS_PAGE = gql`
  query GetModelsPage(
    $adminId: ID
    $page: Int
    $pageSize: Int
    $search: String
    $columnFilters: [ColumnFilter!]
  ) {
    getModelsPage(adminId: $adminId, page: $page, pageSize: $pageSize, search: $search, columnFilters: $columnFilters) {
      total
      items {
        id
        modelcode
        modelname
        status
      }
    }
  }
`;
