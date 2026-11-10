import { useMutation, useQuery } from "@apollo/client";
import {
  ADD_LEAD, EDIT_LEAD, DELETE_LEAD, RESET_LEAD, SET_LEAD_STAGE, CONVERT_LEAD_TO_PARTY,
  ADD_FOLLOWUP, EDIT_FOLLOWUP, DELETE_FOLLOWUP, RESET_FOLLOWUP, COMPLETE_FOLLOWUP,
} from "../../mutations/lead";
import { GET_LEADS, GET_LEADS_PAGE, GET_DELETED_LEADS, GET_LEAD_BY_ID, GET_FOLLOWUPS, GET_DELETED_FOLLOWUPS } from "../../queries/lead";
import { useAppSelector } from "../../../redux/hooks";

export type CrmStage = { key: string; label: string; kind: "open" | "won" | "lost" };

// Used when Business Settings has no CRM lists yet; same stage keys as the server.
export const DEFAULT_STAGES: CrmStage[] = [
  { key: "new", label: "New", kind: "open" },
  { key: "contacted", label: "Contacted", kind: "open" },
  { key: "qualified", label: "Qualified", kind: "open" },
  { key: "quotation", label: "Quotation Sent", kind: "open" },
  { key: "negotiation", label: "Negotiation", kind: "open" },
  { key: "won", label: "Won", kind: "won" },
  { key: "lost", label: "Lost", kind: "lost" },
];
export const DEFAULT_SOURCES = [
  "Walk-in", "Phone Call", "WhatsApp", "Website", "IndiaMART", "TradeIndia", "JustDial", "Facebook", "Instagram", "Google", "Reference", "Exhibition", "Other",
];
export const DEFAULT_LOST_REASONS = ["Price too high", "Bought from competitor", "No requirement now", "No response", "Budget issue", "Other"];
export const FOLLOWUP_TYPES = [
  { value: "call", label: "Call" },
  { value: "visit", label: "Visit" },
  { value: "meeting", label: "Meeting" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "email", label: "Email" },
  { value: "other", label: "Other" },
];
export const TEMPERATURES = [
  { value: "hot", label: "Hot" },
  { value: "warm", label: "Warm" },
  { value: "cold", label: "Cold" },
];
export const leadNo = (l: any) => (l?.leadnumber ? `LD-${l.leadnumber}` : "LD-—");

/** CRM lists from Business Settings, or the defaults. */
export const useCrmLists = () => {
  const s = useAppSelector((st: any) => st.adminsettings.settings);
  const stages: CrmStage[] = s?.crmStages?.length ? s.crmStages : DEFAULT_STAGES;
  return {
    stages,
    sources: s?.crmSources?.length ? s.crmSources : DEFAULT_SOURCES,
    lostReasons: s?.crmLostReasons?.length ? s.crmLostReasons : DEFAULT_LOST_REASONS,
    stageOf: (key?: string) => stages.find((x) => x.key === key) || stages[0],
  };
};

const useBranchFilter = () => {
  const { type, branch, staff } = useAppSelector((s) => s.auth);
  const selectedBranchId = useAppSelector((s) => s.selectedBranch.branchId);
  const branchid = type === "admin" ? selectedBranchId : type === "branch" ? branch?.id : type === "staff" ? staff?.branchid?.id : undefined;
  return { branchid: branchid || undefined };
};

const REFRESH = ["GetLeadsPage", "GetLeads", "GetDeletedLeads", "GetLeadById", "GetFollowups", "GetDeletedFollowups"];

export const useLeadMutations = () => {
  const opts = { refetchQueries: REFRESH };
  const [addLead] = useMutation(ADD_LEAD, opts);
  const [editLead] = useMutation(EDIT_LEAD, opts);
  const [deleteLead] = useMutation(DELETE_LEAD, opts);
  const [resetLead] = useMutation(RESET_LEAD, opts);
  const [setLeadStage] = useMutation(SET_LEAD_STAGE, opts);
  const [convertLead] = useMutation(CONVERT_LEAD_TO_PARTY, opts);
  const [addFollowup] = useMutation(ADD_FOLLOWUP, opts);
  const [editFollowup] = useMutation(EDIT_FOLLOWUP, opts);
  const [deleteFollowup] = useMutation(DELETE_FOLLOWUP, opts);
  const [resetFollowup] = useMutation(RESET_FOLLOWUP, opts);
  const [completeFollowup] = useMutation(COMPLETE_FOLLOWUP, opts);
  return { addLead, editLead, deleteLead, resetLead, setLeadStage, convertLead, addFollowup, editFollowup, deleteFollowup, resetFollowup, completeFollowup };
};

export const useLeadsPageQuery = ({ page, pageSize, search, columnFilters = [] }: {
  page: number; pageSize: number; search: string; columnFilters?: { key: string; value: string }[]; [key: string]: any;
}) => {
  const filter = useBranchFilter();
  const { data, loading, refetch } = useQuery(GET_LEADS_PAGE, {
    variables: { filter, page, pageSize, search, columnFilters },
    fetchPolicy: "cache-and-network",
    notifyOnNetworkStatusChange: true,
  });
  return { items: data?.getLeadsPage?.items ?? [], total: data?.getLeadsPage?.total ?? 0, loading, refetch };
};

/** Every visible lead (board view and pickers); read from the device offline. */
export const useLeadsQuery = (skip = false) => {
  const filter = useBranchFilter();
  return useQuery(GET_LEADS, { variables: { filter }, skip, fetchPolicy: "cache-and-network" });
};

export const useDeletedLeadsQuery = () => {
  const filter = useBranchFilter();
  return useQuery(GET_DELETED_LEADS, { variables: { filter }, fetchPolicy: "cache-and-network" });
};

export const useLeadByIdQuery = (id?: string | null) =>
  useQuery(GET_LEAD_BY_ID, { variables: { id }, skip: !id, fetchPolicy: "cache-and-network" });

/** Follow-ups (all, or one lead's); pending / overdue / done are split on the page. */
export const useFollowupsQuery = (leadid?: string | null, skip = false) => {
  const filter = { ...useBranchFilter(), ...(leadid ? { leadid } : {}) };
  return useQuery(GET_FOLLOWUPS, { variables: { filter }, skip, fetchPolicy: "cache-and-network" });
};

export const useDeletedFollowupsQuery = () => {
  const filter = useBranchFilter();
  return useQuery(GET_DELETED_FOLLOWUPS, { variables: { filter }, fetchPolicy: "cache-and-network" });
};
