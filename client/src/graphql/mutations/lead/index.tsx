import { gql } from "@apollo/client";
import { LEAD_FIELDS, FOLLOWUP_FIELDS } from "../../queries/lead";

export const ADD_LEAD = gql`
  mutation AddLead($input: LeadInput!) {
    addLead(input: $input) { ${LEAD_FIELDS} }
  }
`;
export const EDIT_LEAD = gql`
  mutation EditLead($id: ID!, $input: LeadInput!, $expectedUpdatedAt: String) {
    editLead(id: $id, input: $input, expectedUpdatedAt: $expectedUpdatedAt) { ${LEAD_FIELDS} }
  }
`;
export const DELETE_LEAD = gql`
  mutation DeleteLead($id: ID!, $expectedUpdatedAt: String) {
    deleteLead(id: $id, expectedUpdatedAt: $expectedUpdatedAt)
  }
`;
export const RESET_LEAD = gql`
  mutation ResetLead($id: ID!) {
    resetLead(id: $id)
  }
`;
export const SET_LEAD_STAGE = gql`
  mutation SetLeadStage($id: ID!, $stage: String!, $lostreason: String, $expectedUpdatedAt: String) {
    setLeadStage(id: $id, stage: $stage, lostreason: $lostreason, expectedUpdatedAt: $expectedUpdatedAt) { ${LEAD_FIELDS} }
  }
`;
export const CONVERT_LEAD_TO_PARTY = gql`
  mutation ConvertLeadToParty($id: ID!, $partyid: ID!, $expectedUpdatedAt: String) {
    convertLeadToParty(id: $id, partyid: $partyid, expectedUpdatedAt: $expectedUpdatedAt) { ${LEAD_FIELDS} }
  }
`;
export const ADD_FOLLOWUP = gql`
  mutation AddFollowup($input: FollowupInput!) {
    addFollowup(input: $input) { ${FOLLOWUP_FIELDS} }
  }
`;
export const EDIT_FOLLOWUP = gql`
  mutation EditFollowup($id: ID!, $input: FollowupInput!, $expectedUpdatedAt: String) {
    editFollowup(id: $id, input: $input, expectedUpdatedAt: $expectedUpdatedAt) { ${FOLLOWUP_FIELDS} }
  }
`;
export const DELETE_FOLLOWUP = gql`
  mutation DeleteFollowup($id: ID!, $expectedUpdatedAt: String) {
    deleteFollowup(id: $id, expectedUpdatedAt: $expectedUpdatedAt)
  }
`;
export const RESET_FOLLOWUP = gql`
  mutation ResetFollowup($id: ID!) {
    resetFollowup(id: $id)
  }
`;
export const COMPLETE_FOLLOWUP = gql`
  mutation CompleteFollowup($id: ID!, $outcome: String, $note: String, $expectedUpdatedAt: String) {
    completeFollowup(id: $id, outcome: $outcome, note: $note, expectedUpdatedAt: $expectedUpdatedAt) { ${FOLLOWUP_FIELDS} }
  }
`;

const SOURCE_FIELDS = `source enabled webhookUrl verifyToken ownerids autoFollowup hasKey1 hasKey2 hasKey3 lastPulledAt lastError leadsToday`;
export const SAVE_LEAD_SOURCE = gql`
  mutation SaveLeadSource($input: LeadSourceInput!) { saveLeadSource(input: $input) { ${SOURCE_FIELDS} } }
`;
export const REGENERATE_LEAD_SOURCE_LINK = gql`
  mutation RegenerateLeadSourceLink($source: String!, $adminid: ID) { regenerateLeadSourceLink(source: $source, adminid: $adminid) { ${SOURCE_FIELDS} } }
`;
export const PULL_LEAD_SOURCE_NOW = gql`
  mutation PullLeadSourceNow($source: String!, $adminid: ID) { pullLeadSourceNow(source: $source, adminid: $adminid) }
`;
export const TEST_LEAD_SOURCE = gql`
  mutation TestLeadSource($source: String!, $adminid: ID) { testLeadSource(source: $source, adminid: $adminid) }
`;
export const RETRY_LEAD_INBOX = gql`
  mutation RetryLeadInbox($id: ID!, $adminid: ID) { retryLeadInbox(id: $id, adminid: $adminid) }
`;
