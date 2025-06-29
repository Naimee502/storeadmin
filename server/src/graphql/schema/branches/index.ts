import { gql } from 'apollo-server-express';

export const branchTypeDefs = gql`
  type Admin {
    id: ID!
    name: String!
    email: String!
    subscriptionType: String
    subscribed: Boolean
    subscribedAt: String
    subscriptionEnd: String
    transactionId: String
  }

  type Branch {
    id: ID!
    branchcode: String!
    branchname: String!
    mobile: String!
    password: String!
    logo: String!
    imageurl: String!
    location: String!
    address: String!
    city: String!
    pincode: String!
    phone: String!
    email: String!
    status: Boolean!
    admin: Admin  
  }

  input BranchInput {
    branchname: String!
    mobile: String!
    password: String!
    logo: String!
    imageurl: String!
    location: String!
    address: String!
    city: String!
    pincode: String!
    phone: String!
    email: String!
    status: Boolean!
    admin: ID  
  }

  type Query {
    getBranches(adminId: ID): [Branch!]!
    getBranch(id: ID!, adminId: ID): Branch
    getDeletedBranches(adminId: ID): [Branch!]!
  }

  type Mutation {
    addBranch(input: BranchInput!): Branch!
    addBranches(inputs: [BranchInput!]!): [Branch!]!
    editBranch(id: ID!, input: BranchInput!): Branch!
    deleteBranch(id: ID!): Boolean!
    resetBranch(id: ID!): Boolean!
  }
`;
