import { gql } from "apollo-server-express";

export const locationPingTypeDefs = gql`
  type LocationPing {
    id: ID!
    adminid: ID!
    branchid: ID
    staffid: StaffAccount
    role: String
    latitude: Float!
    longitude: Float!
    accuracy: Float
    speed: Float
    battery: Float
    pingdate: String!
    pingedAt: String
    status: Boolean
    createdAt: String
    updatedAt: String
  }

  input LocationPingInput {
    adminid: ID
    branchid: ID
    staffid: ID!
    role: String
    latitude: Float!
    longitude: Float!
    accuracy: Float
    speed: Float
    battery: Float
    pingdate: String!
    pingedAt: String
  }

  input LocationPingFilterInput {
    adminid: ID
    branchid: ID
    staffid: ID
    role: String
    dateFrom: String
    dateTo: String
  }

  extend type Query {
    getLocationPings(filter: LocationPingFilterInput): [LocationPing!]!
    getLatestLocations(filter: LocationPingFilterInput): [LocationPing!]!
  }

  extend type Mutation {
    addLocationPing(input: LocationPingInput!): LocationPing!
    addLocationPings(inputs: [LocationPingInput!]!): Int!
  }
`;
