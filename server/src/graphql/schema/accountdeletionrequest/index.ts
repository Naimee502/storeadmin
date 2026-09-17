import { gql } from "apollo-server-express";

export const accountDeletionTypeDefs = gql`
  type AccountDeletionMatch {
    docmodel: String
    docid: ID
    adminid: ID
    name: String
    role: String
  }

  type AccountDeletionRequest {
    id: ID!
    mobile: String!
    mobileraw: String
    name: String
    reason: String
    source: String
    requeststatus: String
    deactivatedcount: Int
    matched: [AccountDeletionMatch!]!
    createdAt: String
  }

  type AccountDeletionResult {
    ok: Boolean!
    message: String!
  }

  extend type Query {
    "Back-office audit list. Admin-scoped: only requests that touched this admin's own accounts."
    getAccountDeletionRequests(adminid: ID!, limit: Int): [AccountDeletionRequest!]!
  }

  extend type Mutation {
    """
    PUBLIC — called without a token from the /account-deletion page.
    Always reports success so the endpoint can't be used to test whether a
    number is registered. The real outcome is recorded on the request.
    """
    requestAccountDeletion(mobile: String!, name: String, reason: String): AccountDeletionResult!
  }
`;
