import { gql } from "@apollo/client";

export const CLEAR_DELETED_ENTRIES = gql`
  mutation ClearDeletedEntries($module: String!, $ids: [ID!]!) {
    clearDeletedEntries(module: $module, ids: $ids)
  }
`;
