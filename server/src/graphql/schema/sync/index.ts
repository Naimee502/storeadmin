import { gql } from "apollo-server-express";

// Offline billing: changed records per collection since the last pull.
export const syncTypeDefs = gql`
  type SyncChange {
    collection: String!
    "Live records shaped like the module's list query items."
    docs: JSON!
    "Records deleted (or cleared) since the given time."
    deletedIds: [ID!]!
    "Set when this collection was cut at the per-call cap: pull it again with since = nextSince."
    nextSince: String
  }

  type SyncPull {
    "ISO time to send as since on the next pull."
    serverTime: String!
    changes: [SyncChange!]!
  }

  extend type Query {
    "since null = full pull of live records."
    syncPull(collections: [String!]!, since: String): SyncPull!
  }
`;
