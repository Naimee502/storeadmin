import { gql } from "@apollo/client";

const PARTY = `partyacc { id name mobile city state address gstnumber }`;
const LINE = `productserviceid { id name } variantid { id name } salesunitid { id unitname } unitqty description qty rate amount`;
const STAMP = `status createdAt updatedAt createdby_name`;

export const APPOINTMENT_FIELDS = `id branchid ${PARTY} customername customermobile staffid { id name } services { ${LINE} }
  billdate starttime duration apptStatus membershipid invoiceid notes customfields { key value } ${STAMP}`;
export const JOB_CARD_FIELDS = `id branchid billnumber offlineNumber billdate ${PARTY} customername customermobile productserviceid { id name }
  devicename serial problem accessories estimate { ${LINE} } estimatetotal approved approvedAt spares { ${LINE} }
  technicianid { id name } jobStatus promisedate deliveredAt warrantydays invoiceid notes customfields { key value } ${STAMP}`;
export const CONTRACT_FIELDS = `id branchid ${PARTY} title contractType items { productserviceid { id name } serial note }
  startdate enddate visitsallowed visitsdone amount invoiceid contractStatus notes customfields { key value } ${STAMP}`;
export const PLAN_FIELDS = `id name sessions validitydays price services { id name } notes status createdAt updatedAt`;
export const PRESCRIPTION_FIELDS = `id branchid ${PARTY} customername customermobile appointmentid staffid { id name } doctorname doctorqualification doctorregno rxnumber billdate
  complaints diagnosis vitals { bp pulse temperature weight spo2 sugar } medicines { productserviceid { id name } name dose frequency timing days qty notes } tests advice nextvisit invoiceid ${STAMP}`;
const MVAL = `key label value`;
export const MEASUREMENT_FIELDS = `id branchid ${PARTY} customername customermobile garment values { ${MVAL} } unit takenon notes ${STAMP}`;
export const TAILOR_ORDER_FIELDS = `id branchid ${PARTY} customername customermobile billnumber billdate staffid { id name } trialdate deliverydate orderStatus total advance invoiceid deliveredAt notes
  items { garment productserviceid { id name } qty rate amount fabric fabricnote design values { ${MVAL} } unit } ${STAMP}`;
export const MEMBERSHIP_FIELDS = `id branchid planid { id name } ${PARTY} customername customermobile startdate enddate sessions sessionsused amount invoiceid memberStatus notes ${STAMP}`;

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
export const GET_PRESCRIPTIONS_PAGE = gql`query GetPrescriptionsPage(${PAGE_ARGS}) { getPrescriptionsPage(${PAGE_VARS}) { items { ${PRESCRIPTION_FIELDS} } total } }`;
export const GET_PRESCRIPTIONS = gql`query GetPrescriptions($filter: ServiceFilterInput) { getPrescriptions(filter: $filter) { ${PRESCRIPTION_FIELDS} } }`;
export const GET_DELETED_PRESCRIPTIONS = gql`query GetDeletedPrescriptions($filter: ServiceFilterInput) { getDeletedPrescriptions(filter: $filter) { ${PRESCRIPTION_FIELDS} } }`;
export const GET_PRESCRIPTION_BY_ID = gql`query GetPrescriptionById($id: ID!) { getPrescriptionById(id: $id) { ${PRESCRIPTION_FIELDS} } }`;
export const GET_MEASUREMENTS = gql`query GetMeasurements($filter: ServiceFilterInput, $search: String) { getMeasurements(filter: $filter, search: $search) { ${MEASUREMENT_FIELDS} } }`;
export const GET_LATEST_MEASUREMENTS = gql`query GetLatestMeasurements($partyacc: ID!) { getLatestMeasurements(partyacc: $partyacc) { ${MEASUREMENT_FIELDS} } }`;
export const GET_TAILOR_ORDERS_PAGE = gql`query GetTailorOrdersPage(${PAGE_ARGS}) { getTailorOrdersPage(${PAGE_VARS}) { items { ${TAILOR_ORDER_FIELDS} } total } }`;
export const GET_DELETED_TAILOR_ORDERS = gql`query GetDeletedTailorOrders($filter: ServiceFilterInput) { getDeletedTailorOrders(filter: $filter) { ${TAILOR_ORDER_FIELDS} } }`;
export const GET_TAILOR_ORDER_BY_ID = gql`query GetTailorOrderById($id: ID!) { getTailorOrderById(id: $id) { ${TAILOR_ORDER_FIELDS} } }`;
export const GET_MEMBERSHIP_BY_ID = gql`query GetMembershipById($id: ID!) { getMembershipById(id: $id) { ${MEMBERSHIP_FIELDS} } }`;

// Appointment form: membership sessions used, nothing else.
export const GET_APPOINTMENT_SESSIONS = gql`query GetAppointmentSessions($filter: ServiceFilterInput) { getAppointments(filter: $filter) { id membershipid apptStatus } }`;

// Service forms' item picker: the product picker fields plus service duration, staff and warranty.
export const GET_SERVICE_ITEMS_PICKER = gql`
  query GetServiceItemsPicker($filter: ProductServiceFilterInput, $limit: Int, $offset: Int) {
    getProductServices(filter: $filter, limit: $limit, offset: $offset) {
      id isservice isserialised itemtype cansell canbuy canmake name status
      salesaccountid { id ledgername }
      purchaseaccountid { id ledgername }
      serviceaccountid { id ledgername }
      servicevariants { id name servicerate gst saccode taxinclusive duration { amount unit } staffids warrantydays }
      productvariants {
        id name baseunitid { id unitname } purchaseunitid { id unitname } purchaserate
        unitconversions { unitid { id unitname } factor }
        gst hsncode currentstock moq salemultiple
        unitprices { quantity unitid { id unitname } mrp salesrate discount discounttype offerprice }
      }
    }
  }
`;
