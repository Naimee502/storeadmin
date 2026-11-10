import { gql } from "@apollo/client";

const PARTY = `partyacc { id name mobile city state address gstnumber }`;
const LINE = `productserviceid { id name } variantid { id name } salesunitid { id unitname } unitqty description qty rate amount`;
const STAMP = `status createdAt updatedAt createdby_name`;

export const APPOINTMENT_FIELDS = `id branchid ${PARTY} customername customermobile staffid { id name } services { ${LINE} }
  billdate starttime duration apptStatus membershipid invoiceid notes ${STAMP}`;
export const JOB_CARD_FIELDS = `id branchid billnumber offlineNumber billdate ${PARTY} customername customermobile productserviceid { id name }
  devicename serial problem accessories estimate { ${LINE} } estimatetotal approved approvedAt spares { ${LINE} }
  technicianid { id name } jobStatus promisedate deliveredAt warrantydays invoiceid notes ${STAMP}`;
export const CONTRACT_FIELDS = `id branchid ${PARTY} title contractType items { productserviceid { id name } serial note }
  startdate enddate visitsallowed visitsdone amount contractStatus notes ${STAMP}`;
export const PLAN_FIELDS = `id name sessions validitydays price services { id name } notes status createdAt updatedAt`;
export const MEMBERSHIP_FIELDS = `id branchid planid { id name } ${PARTY} customername customermobile startdate enddate sessions sessionsused amount memberStatus notes ${STAMP}`;

const PAGE_ARGS = `$filter: ServiceFilterInput, $page: Int, $pageSize: Int, $search: String, $columnFilters: [ColumnFilter!]`;
const PAGE_VARS = `filter: $filter, page: $page, pageSize: $pageSize, search: $search, columnFilters: $columnFilters`;

export const GET_APPOINTMENTS = gql`query GetAppointments($filter: ServiceFilterInput) { getAppointments(filter: $filter) { ${APPOINTMENT_FIELDS} } }`;
export const GET_APPOINTMENTS_PAGE = gql`query GetAppointmentsPage(${PAGE_ARGS}) { getAppointmentsPage(${PAGE_VARS}) { items { ${APPOINTMENT_FIELDS} } total } }`;
export const GET_DELETED_APPOINTMENTS = gql`query GetDeletedAppointments($filter: ServiceFilterInput) { getDeletedAppointments(filter: $filter) { ${APPOINTMENT_FIELDS} } }`;
export const GET_APPOINTMENT_BY_ID = gql`query GetAppointmentById($id: ID!) { getAppointmentById(id: $id) { ${APPOINTMENT_FIELDS} } }`;

export const GET_JOB_CARDS = gql`query GetJobCards($filter: ServiceFilterInput) { getJobCards(filter: $filter) { ${JOB_CARD_FIELDS} } }`;
export const GET_JOB_CARDS_PAGE = gql`query GetJobCardsPage(${PAGE_ARGS}) { getJobCardsPage(${PAGE_VARS}) { items { ${JOB_CARD_FIELDS} } total } }`;
export const GET_DELETED_JOB_CARDS = gql`query GetDeletedJobCards($filter: ServiceFilterInput) { getDeletedJobCards(filter: $filter) { ${JOB_CARD_FIELDS} } }`;
export const GET_JOB_CARD_BY_ID = gql`query GetJobCardById($id: ID!) { getJobCardById(id: $id) { ${JOB_CARD_FIELDS} } }`;

export const GET_CONTRACTS = gql`query GetContracts($filter: ServiceFilterInput) { getContracts(filter: $filter) { ${CONTRACT_FIELDS} } }`;
export const GET_CONTRACTS_PAGE = gql`query GetContractsPage(${PAGE_ARGS}) { getContractsPage(${PAGE_VARS}) { items { ${CONTRACT_FIELDS} } total } }`;
export const GET_DELETED_CONTRACTS = gql`query GetDeletedContracts($filter: ServiceFilterInput) { getDeletedContracts(filter: $filter) { ${CONTRACT_FIELDS} } }`;
export const GET_CONTRACT_BY_ID = gql`query GetContractById($id: ID!) { getContractById(id: $id) { ${CONTRACT_FIELDS} } }`;

export const GET_MEMBERSHIP_PLANS = gql`query GetMembershipPlans { getMembershipPlans { ${PLAN_FIELDS} } }`;
export const GET_DELETED_MEMBERSHIP_PLANS = gql`query GetDeletedMembershipPlans { getDeletedMembershipPlans { ${PLAN_FIELDS} } }`;

export const GET_MEMBERSHIPS = gql`query GetMemberships($filter: ServiceFilterInput) { getMemberships(filter: $filter) { ${MEMBERSHIP_FIELDS} } }`;
export const GET_MEMBERSHIPS_PAGE = gql`query GetMembershipsPage(${PAGE_ARGS}) { getMembershipsPage(${PAGE_VARS}) { items { ${MEMBERSHIP_FIELDS} } total } }`;
export const GET_DELETED_MEMBERSHIPS = gql`query GetDeletedMemberships($filter: ServiceFilterInput) { getDeletedMemberships(filter: $filter) { ${MEMBERSHIP_FIELDS} } }`;
export const GET_MEMBERSHIP_BY_ID = gql`query GetMembershipById($id: ID!) { getMembershipById(id: $id) { ${MEMBERSHIP_FIELDS} } }`;
