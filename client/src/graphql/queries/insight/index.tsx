import { gql } from "@apollo/client";

const PULSE_FIELDS = `
  insights {
    id kind title reason value score partyacc productid name mobile city
    dueAt lastorderAt draftmessage state foundAt
    evidence { label detail amount }
  }
  counts
  value
  scannedAt
`;

export const GET_BUSINESS_PULSE = gql`
  query GetBusinessPulse($kind: String, $limit: Int) {
    getBusinessPulse(kind: $kind, limit: $limit) { ${PULSE_FIELDS} }
  }
`;

export const SCAN_BUSINESS_PULSE = gql`
  mutation ScanBusinessPulse { scanBusinessPulse { ${PULSE_FIELDS} } }
`;

export const SET_INSIGHT_STATE = gql`
  mutation SetInsightState($id: ID!, $state: String!) {
    setInsightState(id: $id, state: $state) { id state }
  }
`;

export const GET_SALESMAN_SCORECARD = gql`
  query GetSalesmanScorecard($days: Int) {
    getSalesmanScorecard(days: $days) {
      id name billed bills customers newCustomers
      discount discountPercent collected collectionPercent previousBilled changePercent
    }
  }
`;
