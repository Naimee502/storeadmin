import { gql } from "@apollo/client";

export const SUPPORT_TICKET_FIELDS = `
  id
  ticketno
  subject
  description
  category
  priority
  ticketstatus
  party { id name }
  assignedto { id name }
  raisedby { id name }
  comments { id text bytype byname internal createdAt }
  resolvedAt
  status
  createdAt
  updatedAt
`;

export const GET_SUPPORT_TICKETS = gql`
  query GetSupportTickets($filter: SupportTicketFilter) {
    getSupportTickets(filter: $filter) { ${SUPPORT_TICKET_FIELDS} }
  }
`;

export const GET_SUPPORT_TICKET = gql`
  query GetSupportTicketById($id: ID!) {
    getSupportTicketById(id: $id) { ${SUPPORT_TICKET_FIELDS} }
  }
`;
