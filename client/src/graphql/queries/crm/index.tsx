import { gql } from "@apollo/client";
import { LEAD_FIELDS } from "../lead";

export const OPPORTUNITY_FIELDS = `
  id branchid kind partyacc leadid name mobile city title reason score value
  dueAt lastorderAt draftmessage state convertedleadid actedby_name actedAt foundAt
`;

export const GET_CRM_DASHBOARD = gql`
  query GetCrmDashboard($days: Int) {
    getCrmDashboard(days: $days) {
      days
      openLeads newLeads wonLeads lostLeads wonValue conversion
      followupsDueToday followupsOverdue followupsDone
      quotationsSent quotationsValue quotationsAccepted quotationsAcceptedValue quoteWinRate
      opportunities opportunityValue
      stages { key label kind count value }
      sources { label count }
      trend { date count }
      opportunityKinds { kind count value }
      hotLeads { ${LEAD_FIELDS} }
      todayFollowups { id dueAt type note overdue leadid { id name company mobile city } }
    }
  }
`;

export const GET_OPPORTUNITIES = gql`
  query GetOpportunities($kind: String, $state: String, $limit: Int) {
    getOpportunities(kind: $kind, state: $state, limit: $limit) { ${OPPORTUNITY_FIELDS} }
  }
`;

export const GET_AI_STATUS = gql`
  query GetAiStatus {
    getAiStatus { on enabled agentOn hasKey keysource model cap used left reason }
  }
`;

export const GET_AI_LOGS = gql`
  query GetAiLogs($limit: Int) {
    getAiLogs(limit: $limit) { id task model keysource intokens outtokens ms ok error question username createdAt }
  }
`;
