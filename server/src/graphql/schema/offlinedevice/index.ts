import { gql } from "apollo-server-express";

// Devices that bill offline with their own number series.
export const offlineDeviceTypeDefs = gql`
  type OfflineDevice {
    id: ID!
    adminid: ID!
    branchid: ID
    "Series code, unique per business: A, B, ... Z, AA, AB, ..."
    code: String!
    name: String!
    createdby_id: ID
    createdby_type: String
    "ISO date"
    lastSeen: String
    "Highest sequence used per doc type: { salesinvoice, salesorder, salesreturn, payment }"
    lastSeq: JSON
    "ISO date"
    createdAt: String
    "ISO date"
    updatedAt: String
  }

  extend type Query {
    getOfflineDevices: [OfflineDevice!]!
  }

  extend type Mutation {
    registerOfflineDevice(name: String!): OfflineDevice!
    offlineDeviceHeartbeat(code: String!, lastSeq: JSON): OfflineDevice
  }
`;
