import { gql } from "apollo-server-express";

export const serviceTypeDefs = gql`
  type ServiceLine {
    productserviceid: SimpleRef
    variantid: SimpleRef
    salesunitid: SimpleRef
    unitqty: Float
    description: String
    qty: Float!
    rate: Float
    amount: Float
  }

  input ServiceLineInput {
    productserviceid: ID
    variantid: ID
    salesunitid: ID
    unitqty: Float
    description: String
    qty: Float!
    rate: Float
    amount: Float
  }

  type ServiceParty {
    id: ID
    name: String
    mobile: String
    city: String
    state: String
    address: String
    gstnumber: String
  }

  type Appointment {
    id: ID
    branchid: ID
    partyacc: ServiceParty
    customername: String
    customermobile: String
    staffid: SimpleRef
    services: [ServiceLine!]
    billdate: String!
    starttime: String!
    duration: Float
    apptStatus: String
    membershipid: ID
    invoiceid: ID
    notes: String
    createdby_name: String
    status: Boolean
    createdAt: String
    updatedAt: String
  }

  input AppointmentInput {
    branchid: ID
    partyacc: ID
    customername: String
    customermobile: String
    staffid: ID
    services: [ServiceLineInput!]
    billdate: String!
    starttime: String!
    duration: Float
    membershipid: ID
    notes: String
    clientRequestId: String
  }

  type JobCard {
    id: ID
    branchid: ID
    billnumber: String
    offlineNumber: String
    billdate: String!
    partyacc: ServiceParty
    customername: String
    customermobile: String
    productserviceid: SimpleRef
    devicename: String
    serial: String
    problem: String
    accessories: String
    estimate: [ServiceLine!]
    estimatetotal: Float
    approved: Boolean
    approvedAt: String
    spares: [ServiceLine!]
    technicianid: SimpleRef
    jobStatus: String
    promisedate: String
    deliveredAt: String
    warrantydays: Float
    invoiceid: ID
    notes: String
    createdby_name: String
    status: Boolean
    createdAt: String
    updatedAt: String
  }

  input JobCardInput {
    billnumber: String
    billdate: String!
    branchid: ID
    partyacc: ID
    customername: String
    customermobile: String
    productserviceid: ID
    devicename: String
    serial: String
    problem: String
    accessories: String
    estimate: [ServiceLineInput!]
    estimatetotal: Float
    approved: Boolean
    approvedAt: String
    spares: [ServiceLineInput!]
    technicianid: ID
    promisedate: String
    warrantydays: Float
    notes: String
    clientRequestId: String
  }

  type ContractItem {
    productserviceid: SimpleRef
    serial: String
    note: String
  }

  input ContractItemInput {
    productserviceid: ID
    serial: String
    note: String
  }

  type Contract {
    id: ID
    branchid: ID
    partyacc: ServiceParty
    title: String
    contractType: String
    items: [ContractItem!]
    startdate: String!
    enddate: String!
    visitsallowed: Float
    visitsdone: Float
    amount: Float
    contractStatus: String
    notes: String
    createdby_name: String
    status: Boolean
    createdAt: String
    updatedAt: String
  }

  input ContractInput {
    branchid: ID
    partyacc: ID!
    title: String
    contractType: String
    items: [ContractItemInput!]
    startdate: String!
    enddate: String!
    visitsallowed: Float
    visitsdone: Float
    amount: Float
    contractStatus: String
    notes: String
    clientRequestId: String
  }

  type MembershipPlan {
    id: ID
    name: String!
    sessions: Float
    validitydays: Float
    price: Float
    services: [SimpleRef!]
    notes: String
    status: Boolean
    createdAt: String
    updatedAt: String
  }

  input MembershipPlanInput {
    name: String!
    sessions: Float
    validitydays: Float
    price: Float
    services: [ID!]
    notes: String
    clientRequestId: String
  }

  type Membership {
    id: ID
    branchid: ID
    planid: SimpleRef
    partyacc: ServiceParty
    customername: String
    customermobile: String
    startdate: String!
    enddate: String
    sessions: Float
    "Done appointments booked against this membership."
    sessionsused: Float
    amount: Float
    memberStatus: String
    notes: String
    createdby_name: String
    status: Boolean
    createdAt: String
    updatedAt: String
  }

  input MembershipInput {
    branchid: ID
    planid: ID!
    partyacc: ID
    customername: String
    customermobile: String
    startdate: String!
    enddate: String
    sessions: Float
    amount: Float
    memberStatus: String
    notes: String
    clientRequestId: String
  }

  input ServiceFilterInput {
    branchid: ID
    billdateFrom: String
    billdateTo: String
    staffid: ID
    partyacc: ID
  }

  type AppointmentPage { items: [Appointment!]! total: Int! }
  type JobCardPage { items: [JobCard!]! total: Int! }
  type ContractPage { items: [Contract!]! total: Int! }
  type MembershipPage { items: [Membership!]! total: Int! }

  extend type Query {
    getAppointments(filter: ServiceFilterInput): [Appointment!]!
    getAppointmentsPage(filter: ServiceFilterInput, page: Int, pageSize: Int, search: String, columnFilters: [ColumnFilter!]): AppointmentPage!
    getDeletedAppointments(filter: ServiceFilterInput): [Appointment!]!
    getAppointmentById(id: ID!): Appointment
    getJobCards(filter: ServiceFilterInput): [JobCard!]!
    getJobCardsPage(filter: ServiceFilterInput, page: Int, pageSize: Int, search: String, columnFilters: [ColumnFilter!]): JobCardPage!
    getDeletedJobCards(filter: ServiceFilterInput): [JobCard!]!
    getJobCardById(id: ID!): JobCard
    getContracts(filter: ServiceFilterInput): [Contract!]!
    getContractsPage(filter: ServiceFilterInput, page: Int, pageSize: Int, search: String, columnFilters: [ColumnFilter!]): ContractPage!
    getDeletedContracts(filter: ServiceFilterInput): [Contract!]!
    getContractById(id: ID!): Contract
    getMembershipPlans: [MembershipPlan!]!
    getDeletedMembershipPlans: [MembershipPlan!]!
    getMembershipPlanById(id: ID!): MembershipPlan
    getMemberships(filter: ServiceFilterInput): [Membership!]!
    getMembershipsPage(filter: ServiceFilterInput, page: Int, pageSize: Int, search: String, columnFilters: [ColumnFilter!]): MembershipPage!
    getDeletedMemberships(filter: ServiceFilterInput): [Membership!]!
    getMembershipById(id: ID!): Membership
  }

  extend type Mutation {
    addAppointment(input: AppointmentInput!): Appointment
    editAppointment(id: ID!, input: AppointmentInput!, expectedUpdatedAt: String): Appointment
    "booked, confirmed, arrived, done, noshow or cancelled; invoiceid links the bill made from it."
    setAppointmentStatus(id: ID!, apptStatus: String!, invoiceid: ID, expectedUpdatedAt: String): Appointment
    deleteAppointment(id: ID!, expectedUpdatedAt: String): Boolean
    resetAppointment(id: ID!): Boolean
    addJobCard(input: JobCardInput!): JobCard
    editJobCard(id: ID!, input: JobCardInput!, expectedUpdatedAt: String): JobCard
    "received, diagnosing, waitingapproval, inprogress, ready, delivered or cancelled."
    setJobCardStatus(id: ID!, jobStatus: String!, invoiceid: ID, expectedUpdatedAt: String): JobCard
    deleteJobCard(id: ID!, expectedUpdatedAt: String): Boolean
    resetJobCard(id: ID!): Boolean
    addContract(input: ContractInput!): Contract
    editContract(id: ID!, input: ContractInput!, expectedUpdatedAt: String): Contract
    deleteContract(id: ID!, expectedUpdatedAt: String): Boolean
    resetContract(id: ID!): Boolean
    addMembershipPlan(input: MembershipPlanInput!): MembershipPlan
    editMembershipPlan(id: ID!, input: MembershipPlanInput!, expectedUpdatedAt: String): MembershipPlan
    deleteMembershipPlan(id: ID!, expectedUpdatedAt: String): Boolean
    resetMembershipPlan(id: ID!): Boolean
    addMembership(input: MembershipInput!): Membership
    editMembership(id: ID!, input: MembershipInput!, expectedUpdatedAt: String): Membership
    deleteMembership(id: ID!, expectedUpdatedAt: String): Boolean
    resetMembership(id: ID!): Boolean
  }
`;
