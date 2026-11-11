import { gql } from "apollo-server-express";

export const insightTypeDefs = gql`
  "One row the card was read from, so the owner can check the claim."
  type InsightEvidence {
    label: String!
    detail: String
    amount: Float
  }

  type Insight {
    id: ID!
    kind: String!
    title: String
    reason: String
    evidence: [InsightEvidence!]!
    "Rupees at stake; the list is ranked by this."
    value: Float
    score: Int
    partyacc: ID
    productid: ID
    name: String
    mobile: String
    city: String
    dueAt: String
    lastorderAt: String
    draftmessage: String
    state: String
    foundAt: String
  }

  type BusinessPulse {
    insights: [Insight!]!
    "How many open rows of each kind."
    counts: JSON
    "Total rupees at stake across the open rows."
    value: Float
    scannedAt: String
  }

  type SalesmanRow {
    id: ID!
    name: String!
    billed: Float
    bills: Int
    customers: Int
    newCustomers: Int
    discount: Float
    discountPercent: Int
    "Billed money actually collected, counter payments and later receipts together."
    collected: Float
    collectionPercent: Int
    previousBilled: Float
    changePercent: Int
  }

  extend type Query {
    getBusinessPulse(kind: String, limit: Int): BusinessPulse!
    "How each salesman did over the last N days. A staff login only sees its own row."
    getSalesmanScorecard(days: Int): [SalesmanRow!]!
  }

  extend type Mutation {
    "Look through the business's own data again; no AI is used."
    scanBusinessPulse: BusinessPulse!
    "open, done or dismissed."
    setInsightState(id: ID!, state: String!): Insight
  }
`;
