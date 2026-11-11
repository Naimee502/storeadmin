import { gql } from "apollo-server-express";

export const leadSourceTypeDefs = gql`
  type LeadSourceConfig {
    source: String!
    enabled: Boolean
    "Paste this URL in the portal (or give it to its account manager)."
    webhookUrl: String
    "Meta / WhatsApp verify token."
    verifyToken: String
    ownerids: [ID!]
    autoFollowup: Boolean
    hasKey1: Boolean
    hasKey2: Boolean
    hasKey3: Boolean
    lastPulledAt: String
    lastError: String
    leadsToday: Int
  }

  input LeadSourceInput {
    source: String!
    "Business Settings only; blank means your own business."
    adminid: ID
    enabled: Boolean
    ownerids: [ID!]
    autoFollowup: Boolean
    "Portal keys; blank keeps the saved one."
    key1: String
    key2: String
    key3: String
  }

  type LeadInboxEntry {
    id: ID!
    source: String!
    externalid: String
    result: String
    error: String
    leadid: ID
    payload: JSON
    createdAt: String
  }

  extend type Query {
    "adminid is for Business Settings; blank means your own business."
    getLeadSources(adminid: ID): [LeadSourceConfig!]!
    getLeadInbox(adminid: ID, source: String, result: String, limit: Int): [LeadInboxEntry!]!
  }

  extend type Mutation {
    saveLeadSource(input: LeadSourceInput!): LeadSourceConfig
    "New secret link; the old one stops working."
    regenerateLeadSourceLink(source: String!, adminid: ID): LeadSourceConfig
    "Fetch now (IndiaMART, TradeIndia); returns how many leads came."
    pullLeadSourceNow(source: String!, adminid: ID): Int
    "Make a sample lead through this source, to see it arrive."
    testLeadSource(source: String!, adminid: ID): Boolean
    retryLeadInbox(id: ID!, adminid: ID): Boolean
  }
`;
