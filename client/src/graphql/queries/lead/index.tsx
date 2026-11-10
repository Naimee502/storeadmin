import { gql } from "@apollo/client";

export const LEAD_FIELDS = `
  id
  adminid
  branchid
  leadnumber
  name
  company
  mobile
  altmobile
  email
  address
  city
  state
  pincode
  gstin
  source
  subsource
  requirement
  products { productid { id name } variantid unitid { id unitname } unitqty name qty note }
  expectedvalue
  stage
  temperature
  score
  tags
  ownerid { id name mobile }
  nextfollowupAt
  lastcontactAt
  lostreason
  closedAt
  partyid { id name mobile city }
  customfields { key value }
  notes
  createdby_name
  createdby_type
  status
  createdAt
  updatedAt
`;

export const FOLLOWUP_FIELDS = `
  id
  adminid
  branchid
  leadid { id name mobile city }
  partyid { id name mobile city }
  type
  dueAt
  doneAt
  outcome
  note
  assignedto { id name mobile }
  createdby_name
  status
  createdAt
  updatedAt
`;

export const GET_LEADS = gql`
  query GetLeads($filter: LeadFilterInput) {
    getLeads(filter: $filter) { ${LEAD_FIELDS} }
  }
`;

export const GET_LEADS_PAGE = gql`
  query GetLeadsPage($filter: LeadFilterInput, $page: Int, $pageSize: Int, $search: String, $columnFilters: [ColumnFilter!]) {
    getLeadsPage(filter: $filter, page: $page, pageSize: $pageSize, search: $search, columnFilters: $columnFilters) {
      total
      items { ${LEAD_FIELDS} }
    }
  }
`;

export const GET_DELETED_LEADS = gql`
  query GetDeletedLeads($filter: LeadFilterInput) {
    getDeletedLeads(filter: $filter) { ${LEAD_FIELDS} }
  }
`;

export const GET_LEAD_BY_ID = gql`
  query GetLeadById($id: ID!) {
    getLeadById(id: $id) { ${LEAD_FIELDS} }
  }
`;

export const FIND_LEAD_DUPLICATES = gql`
  query FindLeadDuplicates($mobile: String, $email: String, $gstin: String, $excludeId: ID) {
    findLeadDuplicates(mobile: $mobile, email: $email, gstin: $gstin, excludeId: $excludeId) { id leadnumber name mobile city stage ownerid { id name } }
  }
`;

export const GET_FOLLOWUPS = gql`
  query GetFollowups($filter: FollowupFilterInput) {
    getFollowups(filter: $filter) { ${FOLLOWUP_FIELDS} }
  }
`;

export const GET_DELETED_FOLLOWUPS = gql`
  query GetDeletedFollowups($filter: FollowupFilterInput) {
    getDeletedFollowups(filter: $filter) { ${FOLLOWUP_FIELDS} }
  }
`;

// Lead integrations (Lead Sources screen).
export const GET_LEAD_SOURCES = gql`
  query GetLeadSources {
    getLeadSources { source enabled webhookUrl verifyToken ownerids autoFollowup hasKey1 hasKey2 hasKey3 lastPulledAt lastError leadsToday }
  }
`;
export const GET_LEAD_INBOX = gql`
  query GetLeadInbox($source: String, $result: String, $limit: Int) {
    getLeadInbox(source: $source, result: $result, limit: $limit) { id source externalid result error leadid payload createdAt }
  }
`;
