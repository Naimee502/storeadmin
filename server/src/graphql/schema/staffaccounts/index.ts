import { gql } from "apollo-server-express";

export const staffAccountTypeDefs = gql`
  type Admin {
    id: ID!
    name: String!
    email: String!
    subscriptionType: String
    subscribed: Boolean
    subscribedAt: String
    subscriptionEnd: String
    transactionId: String
    needsReview: Boolean!
    rejected: Boolean!
  }

  type Branch {
    id: ID!
    branchname: String
  }

  type AccountGroup {
    id: ID!
    accountgroupname: String!
  }

  type AccountLedger {
    id: ID!
    ledgername: String!
  }

  type StaffAccount {
    id: ID!
    admin: Admin
    branchid: Branch
    accountgroupid: AccountGroup
    ledgerid: AccountLedger
    staffcode: String
    name: String!
    mobile: String!
    email: String!
    password: String        
    profilepicture: String
    imageurl: String
    address: String
    commission: Float
    salary: Float
    target: Float
    role: String           
    status: Boolean!
    createdAt: String
    updatedAt: String
  }

  input StaffAccountInput {
    admin: ID
    branchid: ID
    accountgroupid: ID
    name: String!
    mobile: String!
    email: String!
    password: String        
    profilepicture: String
    imageurl: String
    address: String
    commission: Float
    salary: Float
    target: Float
    role: String           
    status: Boolean
  }

  input StaffFilterInput {
    adminId: ID
    branchid: ID
    role: String
    accountgroupid: ID
    ledgerid: ID
    mobile: String
    email: String
    salary: Float
    commission: Float
    createdFrom: String
    createdTo: String
  }

  type LoginStaffResponse {
    accessToken: String!
    staff: StaffAccount!
  }

  type Query {
    getStaffAccounts(filter: StaffFilterInput): [StaffAccount!]!
    getDeletedStaffAccounts(filter: StaffFilterInput): [StaffAccount!]!
    getStaffAccountById(id: ID!, adminId: ID): StaffAccount
  }

  type Mutation {
    addStaffAccount(input: StaffAccountInput!): StaffAccount!
    editStaffAccount(id: ID!, input: StaffAccountInput!): StaffAccount!
    loginStaff(email: String!, password: String!): LoginStaffResponse
    deleteStaffAccount(id: ID!): Boolean!
    resetStaffAccount(id: ID!): Boolean!
  }
`;
