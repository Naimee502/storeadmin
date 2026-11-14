import { gql } from "apollo-server-express";

export const customerPortalTypeDefs = gql`
  "Which service menus the signed-in customer sees, with their counts."
  type MyServiceSummary {
    tickets: Boolean!
    openTickets: Int!
    jobcards: Int!
    activeJobcards: Int!
    contracts: Int!
    memberships: Int!
  }

  type MyJobLine {
    name: String!
    qty: Float!
    rate: Float!
    amount: Float!
  }

  "A repair job of the signed-in customer."
  type MyJobCard {
    id: ID!
    billnumber: String!
    billdate: String!
    device: String
    serial: String
    problem: String
    accessories: String
    "received, diagnosing, waitingapproval, inprogress, ready, delivered, cancelled"
    jobStatus: String!
    promisedate: String
    estimate: [MyJobLine!]!
    estimatetotal: Float!
    "null: not answered yet"
    approved: Boolean
    approvedAt: String
    "Estimate is waiting for the customer's answer."
    canApprove: Boolean!
    technician: String
    warrantydays: Int
    warrantyTill: String
    deliveredAt: String
    notes: String
    billed: Boolean!
  }

  type MyContractItem {
    name: String
    serial: String
    note: String
  }

  "AMC or warranty of the signed-in customer."
  type MyContract {
    id: ID!
    title: String
    "amc or warranty"
    contractType: String!
    startdate: String!
    enddate: String!
    daysleft: Int!
    "active, expiring, expired, cancelled"
    state: String!
    visitsallowed: Int
    visitsdone: Int
    amount: Float
    items: [MyContractItem!]!
    notes: String
  }

  type MyMembershipVisit {
    id: ID!
    billdate: String!
    starttime: String
    service: String
    apptStatus: String!
  }

  "Membership of the signed-in customer."
  type MyMembership {
    id: ID!
    plan: String!
    startdate: String!
    enddate: String
    daysleft: Int
    "active, expiring, expired, cancelled, used"
    state: String!
    sessions: Int
    sessionsused: Int!
    sessionsleft: Int
    amount: Float
    services: [String!]!
    visits: [MyMembershipVisit!]!
    notes: String
  }

  extend type Query {
    getMyServiceSummary: MyServiceSummary!
    getMyJobCards: [MyJobCard!]!
    getMyJobCard(id: ID!): MyJobCard!
    getMyContracts: [MyContract!]!
    getMyMemberships: [MyMembership!]!
  }

  extend type Mutation {
    "Customer approves or rejects the repair estimate."
    respondMyJobEstimate(id: ID!, approve: Boolean!, note: String): MyJobCard!
    "Customer asks for a service visit under an AMC or warranty; opens a support ticket."
    requestMyContractService(id: ID!, message: String!): SupportTicket!
    "Short-lived link to a printable job sheet."
    myJobCardPrintLink(id: ID!): String!
  }
`;
