import { gql } from "apollo-server-express";

export const leadTypeDefs = gql`
  type LeadProduct {
    productid: SimpleRef
    variantid: ID
    unitid: SimpleRef
    unitqty: Float
    name: String
    qty: Float
    note: String
  }

  type CustomFieldValue {
    key: String!
    value: String
  }

  type Lead {
    id: ID!
    adminid: ID
    branchid: ID
    leadnumber: String
    name: String!
    company: String
    mobile: String
    altmobile: String
    email: String
    address: String
    city: String
    state: String
    pincode: String
    gstin: String
    source: String
    subsource: String
    externalid: String
    requirement: String
    products: [LeadProduct!]
    expectedvalue: Float
    stage: String
    temperature: String
    score: Float
    tags: [String!]
    ownerid: SimpleRef
    nextfollowupAt: String
    lastcontactAt: String
    lostreason: String
    closedAt: String
    partyid: SimpleRef
    customfields: [CustomFieldValue!]
    notes: String
    createdby_name: String
    createdby_type: String
    status: Boolean
    createdAt: String
    "ISO date"
    updatedAt: String
  }

  input LeadProductInput {
    productid: ID
    variantid: ID
    unitid: ID
    unitqty: Float
    name: String
    qty: Float
    note: String
  }

  input CustomFieldInput {
    key: String!
    value: String
  }

  input LeadInput {
    "Set by offline sync so a retried save returns the same document."
    clientRequestId: String
    branchid: ID
    name: String!
    company: String
    mobile: String
    altmobile: String
    email: String
    address: String
    city: String
    state: String
    pincode: String
    gstin: String
    source: String
    subsource: String
    requirement: String
    products: [LeadProductInput!]
    expectedvalue: Float
    stage: String
    temperature: String
    tags: [String!]
    ownerid: ID
    lostreason: String
    customfields: [CustomFieldInput!]
    notes: String
  }

  input LeadFilterInput {
    branchid: ID
    stage: String
    source: String
    ownerid: ID
    createdAtFrom: String
    createdAtTo: String
  }

  type LeadPage {
    items: [Lead!]!
    total: Int!
  }

  type Followup {
    id: ID!
    adminid: ID
    branchid: ID
    leadid: SimpleRef
    partyid: SimpleRef
    type: String!
    dueAt: String
    doneAt: String
    outcome: String
    note: String
    assignedto: SimpleRef
    createdby_name: String
    status: Boolean
    createdAt: String
    "ISO date"
    updatedAt: String
  }

  input FollowupInput {
    clientRequestId: String
    branchid: ID
    leadid: ID
    partyid: ID
    type: String!
    dueAt: String!
    doneAt: String
    outcome: String
    note: String
    assignedto: ID
  }

  input FollowupFilterInput {
    branchid: ID
    leadid: ID
    assignedto: ID
    "pending, done, overdue or today"
    state: String
    dueAtFrom: String
    dueAtTo: String
  }

  type FollowupPage {
    items: [Followup!]!
    total: Int!
  }

  extend type Query {
    getLeads(filter: LeadFilterInput): [Lead!]!
    getLeadsPage(filter: LeadFilterInput, page: Int, pageSize: Int, search: String, columnFilters: [ColumnFilter!]): LeadPage!
    getDeletedLeads(filter: LeadFilterInput): [Lead!]!
    getLeadById(id: ID!): Lead
    "Leads and parties with this mobile, email or GSTIN (duplicate check)."
    findLeadDuplicates(mobile: String, email: String, gstin: String, excludeId: ID): [Lead!]!
    getFollowups(filter: FollowupFilterInput): [Followup!]!
    getFollowupsPage(filter: FollowupFilterInput, page: Int, pageSize: Int, search: String, columnFilters: [ColumnFilter!]): FollowupPage!
    getDeletedFollowups(filter: FollowupFilterInput): [Followup!]!
    getFollowupById(id: ID!): Followup
  }

  extend type Mutation {
    addLead(input: LeadInput!): Lead
    editLead(id: ID!, input: LeadInput!, expectedUpdatedAt: String): Lead
    deleteLead(id: ID!, expectedUpdatedAt: String): Boolean
    resetLead(id: ID!): Boolean
    "Move to a stage; a lost stage needs a reason."
    setLeadStage(id: ID!, stage: String!, lostreason: String, expectedUpdatedAt: String): Lead
    "Link the Party Account made from this lead."
    convertLeadToParty(id: ID!, partyid: ID!, expectedUpdatedAt: String): Lead
    addFollowup(input: FollowupInput!): Followup
    editFollowup(id: ID!, input: FollowupInput!, expectedUpdatedAt: String): Followup
    deleteFollowup(id: ID!, expectedUpdatedAt: String): Boolean
    resetFollowup(id: ID!): Boolean
    "Close a follow-up with its outcome (the next one is a separate addFollowup)."
    completeFollowup(id: ID!, outcome: String, note: String, expectedUpdatedAt: String): Followup
  }
`;
