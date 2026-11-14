import { gql } from "apollo-server-express";

export const panelLoginTypeDefs = gql`
  "One billing-panel account that matches an email and password."
  type LoginChoice {
    "admin, branch or staff"
    kind: String!
    label: String!
  }

  extend type Mutation {
    "Billing panel sign-in without tabs: which admin, branch or staff accounts this email and password open."
    findLogins(email: String!, password: String!): [LoginChoice!]!
  }
`;
