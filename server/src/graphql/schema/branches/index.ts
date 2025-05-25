import { gql } from 'apollo-server-express';

export const typeDefs = gql`
  type Branch {
    id: ID!
    branchcode: String!
    branchname: String!
    mobile: String!
    password: String!
    logo: String
    location: String!
    address: String!
    city: String!
    pincode: String!
    phone: String!
    email: String!
    status: Boolean!
  }

  input BranchInput {
    branchname: String!
    mobile: String!
    password: String!
    logo: String
    location: String!
    address: String!
    city: String!
    pincode: String!
    phone: String!
    email: String!
    status: Boolean!
  }

  type Query {
    getBranches: [Branch!]!
    getBranch(id: ID!): Branch
  }

  type Mutation {
    addBranch(input: BranchInput!): Branch!
    addBranches(inputs: [BranchInput!]!): [Branch!]! 
    editBranch(id: ID!, input: BranchInput!): Branch!
    deleteBranch(id: ID!): Boolean!
  }
`;
