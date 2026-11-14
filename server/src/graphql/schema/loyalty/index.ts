import { gql } from "apollo-server-express";

export const loyaltyTypeDefs = gql`
  type LoyaltyRules {
    "Loyalty Points module on for this business."
    enabled: Boolean!
    "Points earned per Rs 100 of the bill (with GST)."
    earnPer100: Float!
    "Rupees one point is worth when redeemed."
    pointValue: Float!
    minBill: Float!
    "0 means no cap."
    maxEarn: Float!
    "0 means points never expire."
    expiryDays: Int!
    minRedeem: Float!
    maxRedeemPercent: Float!
  }

  type LoyaltyLine {
    id: ID!
    "earn, redeem, expire, adjust"
    kind: String!
    points: Float!
    docno: String
    note: String
    createdAt: String
  }

  type LoyaltyAccount {
    rules: LoyaltyRules!
    balance: Float!
    "Rupee value of the balance."
    value: Float!
    earned: Float!
    redeemed: Float!
    history: [LoyaltyLine!]!
  }

  type LoyaltyPartyRow {
    partyid: ID!
    name: String
    mobile: String
    city: String
    earned: Float!
    redeemed: Float!
    expired: Float!
    balance: Float!
  }

  type LoyaltySummary {
    rules: LoyaltyRules!
    earned: Float!
    redeemed: Float!
    expired: Float!
    balance: Float!
    "Rupee value of all unused points."
    liability: Float!
    parties: [LoyaltyPartyRow!]!
  }

  extend type Query {
    "A party's points for billing (staff / admin)."
    getPartyLoyalty(partyid: ID!): LoyaltyAccount!
    "The signed-in customer's points."
    getMyLoyalty: LoyaltyAccount!
    getLoyaltySummary: LoyaltySummary!
  }

  extend type Mutation {
    "Owner adds or removes points by hand, with a note."
    adjustLoyaltyPoints(partyid: ID!, points: Float!, note: String!): LoyaltyAccount!
  }
`;
