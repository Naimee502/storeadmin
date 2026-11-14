import { gql } from "@apollo/client";

export const GET_MY_SERVICE_SUMMARY = gql`
  query GetMyServiceSummary {
    getMyServiceSummary { tickets openTickets jobcards activeJobcards contracts memberships loyaltyPoints prescriptions }
  }
`;

const TICKET = `id ticketno subject description category priority ticketstatus createdAt updatedAt resolvedAt
  comments { id text bytype byname createdAt }`;

export const GET_MY_TICKETS = gql`query GetMyTickets { getSupportTickets { ${TICKET} } }`;
export const GET_MY_TICKET = gql`query GetMyTicket($id: ID!) { getSupportTicketById(id: $id) { ${TICKET} } }`;
export const ADD_MY_TICKET = gql`mutation AddMyTicket($input: SupportTicketInput!) { addSupportTicket(input: $input) { ${TICKET} } }`;
export const REPLY_MY_TICKET = gql`mutation ReplyMyTicket($id: ID!, $text: String!) { addSupportTicketComment(id: $id, text: $text) { ${TICKET} } }`;
export const SET_MY_TICKET_STATUS = gql`mutation SetMyTicketStatus($id: ID!, $ticketstatus: String!) { setSupportTicketStatus(id: $id, ticketstatus: $ticketstatus) { ${TICKET} } }`;

const JOB = `id billnumber billdate device serial problem accessories jobStatus promisedate
  estimate { name qty rate amount } estimatetotal approved approvedAt canApprove technician
  warrantydays warrantyTill deliveredAt notes billed`;

export const GET_MY_JOBCARDS = gql`query GetMyJobCards { getMyJobCards { ${JOB} } }`;
export const GET_MY_JOBCARD = gql`query GetMyJobCard($id: ID!) { getMyJobCard(id: $id) { ${JOB} } }`;
export const RESPOND_MY_ESTIMATE = gql`mutation RespondMyEstimate($id: ID!, $approve: Boolean!, $note: String) { respondMyJobEstimate(id: $id, approve: $approve, note: $note) { ${JOB} } }`;
export const MY_JOBCARD_PRINT_LINK = gql`mutation MyJobCardPrintLink($id: ID!) { myJobCardPrintLink(id: $id) }`;

export const GET_MY_CONTRACTS = gql`
  query GetMyContracts {
    getMyContracts { id title contractType startdate enddate daysleft state visitsallowed visitsdone amount notes items { name serial note } }
  }
`;
export const REQUEST_CONTRACT_SERVICE = gql`
  mutation RequestContractService($id: ID!, $message: String!) {
    requestMyContractService(id: $id, message: $message) { id ticketno }
  }
`;

export const GET_MY_MEMBERSHIPS = gql`
  query GetMyMemberships {
    getMyMemberships {
      id plan startdate enddate daysleft state sessions sessionsused sessionsleft amount services notes
      visits { id billdate starttime service apptStatus }
    }
  }
`;

const RX = `id rxnumber billdate doctorname doctorqualification complaints diagnosis vitals { bp pulse temperature weight spo2 sugar }
  medicines { name dose frequency timing days notes } tests advice nextvisit`;
export const GET_MY_PRESCRIPTIONS = gql`query GetMyPrescriptions { getMyPrescriptions { ${RX} } }`;
export const GET_MY_PRESCRIPTION = gql`query GetMyPrescription($id: ID!) { getMyPrescription(id: $id) { ${RX} } }`;
export const MY_PRESCRIPTION_PRINT_LINK = gql`mutation MyPrescriptionPrintLink($id: ID!) { myPrescriptionPrintLink(id: $id) }`;
