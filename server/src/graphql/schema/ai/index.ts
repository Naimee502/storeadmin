import { gql } from "apollo-server-express";

export const aiTypeDefs = gql`
  type CrmStageCount {
    key: String!
    label: String!
    kind: String!
    count: Int!
    value: Float!
  }

  type CrmLabelCount {
    label: String!
    count: Int!
  }

  type CrmDayCount {
    date: String!
    count: Int!
  }

  type OpportunityKind {
    kind: String!
    count: Int!
    value: Float!
  }

  type CrmTodayFollowup {
    id: ID!
    dueAt: String
    type: String
    note: String
    overdue: Boolean
    leadid: SimpleRef
  }

  type CrmDashboard {
    days: Int!
    openLeads: Int!
    newLeads: Int!
    wonLeads: Int!
    lostLeads: Int!
    wonValue: Float!
    "Won as a share of leads closed in the period."
    conversion: Int!
    followupsDueToday: Int!
    followupsOverdue: Int!
    followupsDone: Int!
    quotationsSent: Int!
    quotationsValue: Float!
    quotationsAccepted: Int!
    quotationsAcceptedValue: Float!
    quoteWinRate: Int!
    opportunities: Int!
    opportunityValue: Float!
    stages: [CrmStageCount!]!
    sources: [CrmLabelCount!]!
    trend: [CrmDayCount!]!
    opportunityKinds: [OpportunityKind!]!
    hotLeads: [Lead!]!
    todayFollowups: [CrmTodayFollowup!]!
  }

  type Opportunity {
    id: ID!
    branchid: ID
    "dormant, coldquote, nofollowup, amcdue, servicedue"
    kind: String!
    partyacc: ID
    leadid: ID
    name: String
    mobile: String
    city: String
    title: String
    reason: String
    score: Int
    value: Float
    dueAt: String
    lastorderAt: String
    draftmessage: String
    "open, done, dismissed, converted"
    state: String
    convertedleadid: ID
    actedby_name: String
    actedAt: String
    foundAt: String
    createdAt: String
    updatedAt: String
  }

  type AiStatus {
    "True only when AI is on, a key is set and the cap is not used up."
    on: Boolean!
    enabled: Boolean!
    agentOn: Boolean!
    hasKey: Boolean!
    "platform or own"
    keysource: String
    model: String
    cap: Int!
    used: Int!
    left: Int!
    reason: String
  }

  type AiLog {
    id: ID!
    task: String!
    model: String
    keysource: String
    intokens: Int
    outtokens: Int
    ms: Int
    ok: Boolean
    error: String
    question: String
    username: String
    createdAt: String
  }

  type AiAnswer {
    ok: Boolean!
    answer: String!
    "Which data the agent looked at, so the user can see its working."
    steps: [String!]!
    reason: String
  }

  type AiText {
    ok: Boolean!
    text: String!
    reason: String
  }

  type AiInquiryFields {
    name: String
    company: String
    mobile: String
    email: String
    city: String
    state: String
    requirement: String
    qty: Float
    expectedvalue: Float
    temperature: String
    score: Int
    scorereason: String
  }

  type AiInquiry {
    ok: Boolean!
    fields: AiInquiryFields
    reason: String
  }

  type OpportunityScan {
    found: Int!
    kinds: [OpportunityKind!]!
  }

  extend type Query {
    getCrmDashboard(days: Int): CrmDashboard!
    getOpportunities(kind: String, state: String, limit: Int): [Opportunity!]!
    getAiStatus: AiStatus!
    getAiLogs(limit: Int): [AiLog!]!
  }

  extend type Mutation {
    "Re-runs the finders over this business's own data."
    refreshOpportunities: OpportunityScan!
    setOpportunityState(id: ID!, state: String!): Opportunity
    convertOpportunityToLead(id: ID!): Lead
    "The CRM dashboard agent. Reads this tenant's data only; changes nothing."
    askAi(question: String!): AiAnswer!
    aiReadInquiry(text: String!): AiInquiry!
    "channel: whatsapp, email or call."
    aiDraftMessage(leadid: ID!, channel: String, instruction: String): AiText!
    aiDraftForOpportunity(id: ID!): AiText!
  }
`;
