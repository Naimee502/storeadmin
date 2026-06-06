import { gql } from 'apollo-server-express';

export const accountTypeDefs = gql`
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

  type Salesman {
    id: ID!
    name: String!
  }

  type AccountGroup {
    id: ID!
    accountgroupname: String!
  }

  type AccountLedger {
    id: ID!
    ledgername: String!
  }

  type Account {
    id: ID!
    accountcode: String!
    name: String!
    type: String
    accountgroupid: AccountGroup
    ledgerid: AccountLedger
    mobile: String
    email: String
    gstnumber: String
    pan: String
    address: String
    city: String
    state: String
    country: String
    pincode: String
    openingbalance: Float
    openingbalancetype: String
    creditlimit: Float
    bankname: String
    bankaccountnumber: String
    ifsc: String
    upiid: String
    billingcycle: String
    duedays: Int
    assignaccountid: Account
    # Live ledger balance (Dr−Cr across posted transactions). Populated only by
    # resolvers that need it (e.g. sales routes); null elsewhere.
    outstanding: Float
    salesmanid: Salesman
    latitude: Float
    longitude: Float
    otp: String
    channel: Channel
    region: String
    status: Boolean!
    branchid: Branch
    admin: Admin
    createdAt: String
    updatedAt: String
  }

  input AccountInput {
    name: String!
    type: String
    channel: ID
    region: String
    accountgroupid: ID!
    mobile: String
    email: String
    gstnumber: String
    pan: String
    address: String
    city: String
    state: String
    country: String
    pincode: String
    openingbalance: Float
    openingbalancetype: String
    creditlimit: Float
    bankname: String
    bankaccountnumber: String
    ifsc: String
    upiid: String
    billingcycle: String
    duedays: Int
    assignaccountid: ID
    salesmanid: ID
    latitude: Float
    longitude: Float
    otp: String
    status: Boolean
    branchid: ID
    admin: ID
  }

  input AccountFilterInput {
    admin: ID
    branchid: ID
    type: String
    channel: ID
    region: String
    accountgroupid: ID
    ledgerid: ID
    accountcode: String
    mobile: String
    email: String
    gstnumber: String
    pan: String
    city: String
    state: String
    country: String
    pincode: String
    billingcycle: String
    openingbalancetype: String
    status: Boolean
    createdFrom: String
    createdTo: String
    latitude: Float
    longitude: Float
  }

  type SendOTPResponse {
    success: Boolean!
    message: String!
    otp: String
  }

  type VerifyOTPResponse {
    accessToken: String!
    account: Account!
  }

  type Query {
    getAccounts(filter: AccountFilterInput): [Account!]!
    getAccountById(id: ID!, adminId: ID): Account
  }

  type Mutation {
    addAccount(input: AccountInput!): Account!
    editAccount(id: ID!, input: AccountInput!): Account!
    deleteAccount(id: ID!): Boolean!
    resetAccount(id: ID!): Boolean!
    sendOTP(adminId: ID!, mobile: String!): SendOTPResponse!
    verifyOTP(adminId: ID!, mobile: String!, otp: String!): VerifyOTPResponse!
  }
`;
