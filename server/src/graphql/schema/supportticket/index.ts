import { gql } from "apollo-server-express";

export const supportTicketTypeDefs = gql`
  type SupportTicketComment {
    id: ID!
    text: String!
    bytype: String
    byname: String
    internal: Boolean
    createdAt: String
  }

  type SupportTicketPerson {
    id: ID
    name: String
  }

  type SupportTicket {
    id: ID!
    ticketno: String!
    subject: String!
    description: String
    category: String
    "low, normal, high, urgent"
    priority: String!
    "open, inprogress, waiting, resolved, closed"
    ticketstatus: String!
    party: SupportTicketPerson
    assignedto: SupportTicketPerson
    raisedby: SupportTicketPerson
    comments: [SupportTicketComment!]!
    resolvedAt: String
    status: Boolean!
    createdAt: String
    updatedAt: String
  }

  input SupportTicketInput {
    subject: String!
    description: String
    category: String
    priority: String
    partyid: ID
    assignedto: ID
  }

  input SupportTicketFilter {
    ticketstatus: String
    assignedto: ID
    partyid: ID
    "Deleted tickets when true."
    deleted: Boolean
  }

  extend type Query {
    getSupportTickets(filter: SupportTicketFilter): [SupportTicket!]!
    getSupportTicketById(id: ID!): SupportTicket
  }

  extend type Mutation {
    addSupportTicket(input: SupportTicketInput!): SupportTicket!
    editSupportTicket(id: ID!, input: SupportTicketInput!): SupportTicket!
    setSupportTicketStatus(id: ID!, ticketstatus: String!): SupportTicket!
    addSupportTicketComment(id: ID!, text: String!, internal: Boolean): SupportTicket!
    deleteSupportTicket(id: ID!): Boolean!
    resetSupportTicket(id: ID!): Boolean!
  }
`;
