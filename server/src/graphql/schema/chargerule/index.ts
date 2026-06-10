import { gql } from "apollo-server-express";

export const chargeRuleTypeDefs = gql`
  type ChargeRule {
    id: ID!
    adminid: ID!
    name: String!
    ledgerid: SimpleRef
    chargeType: String!
    value: Float!
    gstpercent: Float
    minOrderValue: Float
    freeAboveValue: Float
    applyToCreatorTypes: [String]
    paymentTypes: [String]
    onlyWhenDeliveryBoy: Boolean
    priority: Int
    active: Boolean!
    status: Boolean!
    createdAt: String
    updatedAt: String
  }

  input ChargeRuleInput {
    adminid: ID!
    name: String!
    ledgerid: ID
    chargeType: String
    value: Float!
    gstpercent: Float
    minOrderValue: Float
    freeAboveValue: Float
    applyToCreatorTypes: [String]
    paymentTypes: [String]
    onlyWhenDeliveryBoy: Boolean
    priority: Int
    active: Boolean
    status: Boolean
  }

  extend type Query {
    getChargeRules(adminid: ID!): [ChargeRule!]!
    getDeletedChargeRules(adminid: ID!): [ChargeRule!]!
    getChargeRuleById(id: ID!): ChargeRule
  }

  extend type Mutation {
    addChargeRule(input: ChargeRuleInput!): ChargeRule!
    editChargeRule(id: ID!, input: ChargeRuleInput!): ChargeRule!
    deleteChargeRule(id: ID!): Boolean!
    resetChargeRule(id: ID!): Boolean!
  }
`;
