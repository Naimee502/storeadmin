import { gql } from "apollo-server-express";

// Dedicated permissions API. Permissions are stored as a Mixed JSON map
// on Admin/Branch/Staff documents. We use a simple JSON-string codec to
// transport them through GraphQL because the action-set may evolve over
// time and we don't want a strict typeDef for every action.

export const permissionsTypeDefs = gql`
  scalar JSON

  enum PermissionScope {
    admin
    branch
    staff
  }

  type PermissionDoc {
    scope: PermissionScope!
    scopeid: ID!         # adminid for "admin", branchid for "branch", staffid for "staff"
    permissions: JSON!   # { module: { action: bool, ... } }
  }

  extend type Query {
    # Returns the raw stored permissions for the given scope/id.
    getPermissions(scope: PermissionScope!, scopeid: ID!): PermissionDoc!

    # Returns the EFFECTIVE permissions for a branch or staff after
    # merging Admin defaults → Branch override → Staff override (in that
    # priority). Used by the client at session bootstrap.
    getEffectivePermissions(scope: PermissionScope!, scopeid: ID!): PermissionDoc!
  }

  extend type Mutation {
    # Replace the permissions JSON for the given scope/id. Caller sends
    # the full map (we don't merge here — UI should read first, modify,
    # then write the whole thing back).
    setPermissions(
      scope: PermissionScope!
      scopeid: ID!
      permissions: JSON!
    ): PermissionDoc!
  }
`;
