import { gql } from "@apollo/client";

export const REQUEST_ACCOUNT_DELETION = gql`
  mutation RequestAccountDeletion($mobile: String!, $name: String, $reason: String) {
    requestAccountDeletion(mobile: $mobile, name: $name, reason: $reason) {
      ok
      message
    }
  }
`;
