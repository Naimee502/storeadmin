import { gql } from "@apollo/client";
import { SUPPORT_TICKET_FIELDS } from "../../queries/supportticket";

export const ADD_SUPPORT_TICKET = gql`
  mutation AddSupportTicket($input: SupportTicketInput!) { addSupportTicket(input: $input) { ${SUPPORT_TICKET_FIELDS} } }
`;
export const EDIT_SUPPORT_TICKET = gql`
  mutation EditSupportTicket($id: ID!, $input: SupportTicketInput!) { editSupportTicket(id: $id, input: $input) { ${SUPPORT_TICKET_FIELDS} } }
`;
export const SET_SUPPORT_TICKET_STATUS = gql`
  mutation SetSupportTicketStatus($id: ID!, $ticketstatus: String!) { setSupportTicketStatus(id: $id, ticketstatus: $ticketstatus) { ${SUPPORT_TICKET_FIELDS} } }
`;
export const ADD_SUPPORT_TICKET_COMMENT = gql`
  mutation AddSupportTicketComment($id: ID!, $text: String!, $internal: Boolean) {
    addSupportTicketComment(id: $id, text: $text, internal: $internal) { ${SUPPORT_TICKET_FIELDS} }
  }
`;
export const DELETE_SUPPORT_TICKET = gql`
  mutation DeleteSupportTicket($id: ID!) { deleteSupportTicket(id: $id) }
`;
export const RESET_SUPPORT_TICKET = gql`
  mutation ResetSupportTicket($id: ID!) { resetSupportTicket(id: $id) }
`;
