import { useMutation, useQuery } from "@apollo/client";
import * as M from "../../mutations/service";
import * as Q from "../../queries/service";
import { useAppSelector } from "../../../redux/hooks";
import { partyLabel } from "../../../utils/partylabel";

export const APPT_STATUS: Record<string, string> = { booked: "Booked", confirmed: "Confirmed", arrived: "Arrived", done: "Done", noshow: "No Show", cancelled: "Cancelled" };
export const JOB_STATUS: Record<string, string> = {
  received: "Received", diagnosing: "Diagnosing", waitingapproval: "Waiting Approval", inprogress: "In Progress", ready: "Ready", delivered: "Delivered", cancelled: "Cancelled",
};
export const CONTRACT_TYPE: Record<string, string> = { amc: "AMC", warranty: "Warranty" };

/** "JC-000012" (or the device number offline). */
export const jobCardNo = (j: any) => {
  const n = String(j?.billnumber || j?.offlineNumber || "");
  return n.startsWith("JC-") ? n : `JC-${n}`;
};
/** "Name - Mobile - City" for a party, else the walk-in name and mobile. */
export const customerLabel = (d: any) =>
  d?.partyacc?.id ? partyLabel(d.partyacc) : partyLabel({ name: d?.customername, mobile: d?.customermobile }) || "—";
export const addDaysYMD = (ymd: string, n: number) => {
  const d = new Date(`${ymd}T00:00:00`);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

export const useServiceBranch = () => {
  const { type, branch, staff } = useAppSelector((s) => s.auth);
  const selectedBranchId = useAppSelector((s) => s.selectedBranch.branchId);
  const branchid = type === "admin" ? selectedBranchId : type === "branch" ? branch?.id : type === "staff" ? staff?.branchid?.id : undefined;
  return branchid || undefined;
};

const REFRESH = [
  "GetAppointments", "GetAppointmentsPage", "GetDeletedAppointments", "GetAppointmentById",
  "GetJobCards", "GetJobCardsPage", "GetDeletedJobCards", "GetJobCardById",
  "GetContracts", "GetContractsPage", "GetDeletedContracts", "GetContractById",
  "GetMembershipPlans", "GetDeletedMembershipPlans", "GetMemberships", "GetMembershipsPage", "GetDeletedMemberships", "GetMembershipById",
];

export const useServiceMutations = () => {
  const o = { refetchQueries: REFRESH };
  const useOne = (doc: any) => useMutation(doc, o)[0];
  return {
    addAppointment: useOne(M.ADD_APPOINTMENT), editAppointment: useOne(M.EDIT_APPOINTMENT), deleteAppointment: useOne(M.DELETE_APPOINTMENT),
    resetAppointment: useOne(M.RESET_APPOINTMENT), setAppointmentStatus: useOne(M.SET_APPOINTMENT_STATUS),
    addJobCard: useOne(M.ADD_JOB_CARD), editJobCard: useOne(M.EDIT_JOB_CARD), deleteJobCard: useOne(M.DELETE_JOB_CARD),
    resetJobCard: useOne(M.RESET_JOB_CARD), setJobCardStatus: useOne(M.SET_JOB_CARD_STATUS),
    addContract: useOne(M.ADD_CONTRACT), editContract: useOne(M.EDIT_CONTRACT), deleteContract: useOne(M.DELETE_CONTRACT), resetContract: useOne(M.RESET_CONTRACT),
    addMembershipPlan: useOne(M.ADD_MEMBERSHIP_PLAN), editMembershipPlan: useOne(M.EDIT_MEMBERSHIP_PLAN),
    deleteMembershipPlan: useOne(M.DELETE_MEMBERSHIP_PLAN), resetMembershipPlan: useOne(M.RESET_MEMBERSHIP_PLAN),
    addMembership: useOne(M.ADD_MEMBERSHIP), editMembership: useOne(M.EDIT_MEMBERSHIP), deleteMembership: useOne(M.DELETE_MEMBERSHIP), resetMembership: useOne(M.RESET_MEMBERSHIP),
  };
};

const live = { fetchPolicy: "cache-and-network" as const, notifyOnNetworkStatusChange: true };
type PageVars = { page: number; pageSize: number; search: string; columnFilters?: { key: string; value: string }[]; [k: string]: any };

const usePage = (doc: any, field: string, v: PageVars, extra: Record<string, any> = {}) => {
  const branchid = useServiceBranch();
  const { data, loading, refetch } = useQuery(doc, {
    variables: { filter: { branchid, ...extra }, page: v.page, pageSize: v.pageSize, search: v.search, columnFilters: v.columnFilters || [] },
    ...live,
  });
  return { items: data?.[field]?.items ?? [], total: data?.[field]?.total ?? 0, loading, refetch };
};
const useList = (doc: any, filter: Record<string, any> = {}, skip = false) => {
  const branchid = useServiceBranch();
  return useQuery(doc, { variables: { filter: { branchid, ...filter } }, skip, ...live });
};
const useById = (doc: any, id?: string | null) => useQuery(doc, { variables: { id }, skip: !id, ...live });

export const useAppointmentsPageQuery = (v: PageVars) => usePage(Q.GET_APPOINTMENTS_PAGE, "getAppointmentsPage", v);
export const useAppointmentsQuery = (filter: Record<string, any> = {}, skip = false) => useList(Q.GET_APPOINTMENTS, filter, skip);
export const useDeletedAppointmentsQuery = () => useList(Q.GET_DELETED_APPOINTMENTS);
export const useAppointmentByIdQuery = (id?: string | null) => useById(Q.GET_APPOINTMENT_BY_ID, id);

export const useJobCardsPageQuery = (v: PageVars) => usePage(Q.GET_JOB_CARDS_PAGE, "getJobCardsPage", v);
export const useJobCardsQuery = (filter: Record<string, any> = {}, skip = false) => useList(Q.GET_JOB_CARDS, filter, skip);
export const useDeletedJobCardsQuery = () => useList(Q.GET_DELETED_JOB_CARDS);
export const useJobCardByIdQuery = (id?: string | null) => useById(Q.GET_JOB_CARD_BY_ID, id);

export const useContractsPageQuery = (v: PageVars) => usePage(Q.GET_CONTRACTS_PAGE, "getContractsPage", v);
export const useContractsQuery = (filter: Record<string, any> = {}, skip = false) => useList(Q.GET_CONTRACTS, filter, skip);
export const useDeletedContractsQuery = () => useList(Q.GET_DELETED_CONTRACTS);
export const useContractByIdQuery = (id?: string | null) => useById(Q.GET_CONTRACT_BY_ID, id);

export const useMembershipPlansQuery = () => useQuery(Q.GET_MEMBERSHIP_PLANS, live);
export const useDeletedMembershipPlansQuery = () => useQuery(Q.GET_DELETED_MEMBERSHIP_PLANS, live);
export const useMembershipsPageQuery = (v: PageVars) => usePage(Q.GET_MEMBERSHIPS_PAGE, "getMembershipsPage", v);
export const useMembershipsQuery = (filter: Record<string, any> = {}, skip = false) => useList(Q.GET_MEMBERSHIPS, filter, skip);
export const useDeletedMembershipsQuery = () => useList(Q.GET_DELETED_MEMBERSHIPS);
export const useMembershipByIdQuery = (id?: string | null) => useById(Q.GET_MEMBERSHIP_BY_ID, id);

/** Sessions left on a membership, counting done appointments (works offline from device data). */
export const sessionsLeft = (m: any, appointments: any[] = []) => {
  if (!m?.sessions) return null;
  const used = Math.max(Number(m.sessionsused || 0), appointments.filter((a) => a.membershipid === m.id && a.apptStatus === "done").length);
  return Math.max(Number(m.sessions) - used, 0);
};
