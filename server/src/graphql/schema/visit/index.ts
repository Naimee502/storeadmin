import { gql } from "apollo-server-express";

export const visitTypeDefs = gql`
  type Visit {
    id: ID!
    adminid: ID!
    branchid: ID
    salesmanid: StaffAccount
    partyacc: Account
    routeid: SalesRoute
    visitdate: String!
    day: String
    visited: Boolean
    reason: String
    notes: String
    ordercreated: Boolean
    orderid: ID
    latitude: Float
    longitude: Float
    visitedAt: String
    createdby_id: ID
    createdby_name: String
    createdby_type: String
    status: Boolean
    createdAt: String
    updatedAt: String
  }

  input VisitInput {
    adminid: ID
    branchid: ID
    salesmanid: ID!
    partyacc: ID!
    routeid: ID
    visitdate: String!
    day: String
    visited: Boolean
    reason: String
    notes: String
    ordercreated: Boolean
    orderid: ID
    latitude: Float
    longitude: Float
    visitedAt: String
    createdby_id: ID
    createdby_name: String
    createdby_type: String
    status: Boolean
  }

  input VisitFilterInput {
    adminid: ID
    branchid: ID
    salesmanid: ID
    routeid: ID
    partyacc: ID
    day: String
    visited: Boolean
    dateFrom: String
    dateTo: String
    status: Boolean
  }

  extend type Query {
    getVisits(filter: VisitFilterInput): [Visit!]!
  }

  extend type Mutation {
    addVisit(input: VisitInput!): Visit!
    editVisit(id: ID!, input: VisitInput!): Visit!
    deleteVisit(id: ID!): Boolean!
  }
`;
