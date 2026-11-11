import { useMutation, useQuery } from "@apollo/client";
import * as M from "../../mutations/crm";
import * as Q from "../../queries/crm";

export const OPPORTUNITY_KINDS: Record<string, { label: string; tone: string }> = {
  dormant: { label: "Gone Quiet", tone: "bg-amber-50 text-amber-700 ring-amber-200" },
  coldquote: { label: "Quotation Waiting", tone: "bg-sky-50 text-sky-700 ring-sky-200" },
  nofollowup: { label: "Follow Up Due", tone: "bg-rose-50 text-rose-700 ring-rose-200" },
  amcdue: { label: "AMC / Warranty", tone: "bg-teal-50 text-teal-700 ring-teal-200" },
  servicedue: { label: "Service Due", tone: "bg-violet-50 text-violet-700 ring-violet-200" },
};

const live = { fetchPolicy: "cache-and-network" as const };
const REFRESH = ["GetCrmDashboard", "GetOpportunities", "GetAiStatus"];

export const useCrmDashboardQuery = (days = 30) =>
  useQuery(Q.GET_CRM_DASHBOARD, { variables: { days }, ...live, notifyOnNetworkStatusChange: true });

export const useOpportunitiesQuery = (kind?: string, state = "open") =>
  useQuery(Q.GET_OPPORTUNITIES, { variables: { kind: kind || undefined, state, limit: 50 }, ...live });

export const useAiStatusQuery = () => useQuery(Q.GET_AI_STATUS, live);
export const useAiLogsQuery = (limit = 50) => useQuery(Q.GET_AI_LOGS, { variables: { limit }, ...live });

export const useCrmMutations = () => {
  const opts = { refetchQueries: REFRESH };
  const [refreshOpportunities] = useMutation(M.REFRESH_OPPORTUNITIES, opts);
  const [setOpportunityState] = useMutation(M.SET_OPPORTUNITY_STATE, opts);
  const [convertOpportunityToLead] = useMutation(M.CONVERT_OPPORTUNITY_TO_LEAD, {
    refetchQueries: [...REFRESH, "GetLeadsPage", "GetLeads"],
  });
  // The agent only reads, so nothing is refetched after it answers.
  const [askAi] = useMutation(M.ASK_AI, { refetchQueries: ["GetAiStatus"] });
  const [aiReadInquiry] = useMutation(M.AI_READ_INQUIRY, { refetchQueries: ["GetAiStatus"] });
  const [aiDraftMessage] = useMutation(M.AI_DRAFT_MESSAGE, { refetchQueries: ["GetAiStatus"] });
  const [aiDraftForOpportunity] = useMutation(M.AI_DRAFT_FOR_OPPORTUNITY, { refetchQueries: [...REFRESH] });
  return { refreshOpportunities, setOpportunityState, convertOpportunityToLead, askAi, aiReadInquiry, aiDraftMessage, aiDraftForOpportunity };
};

/** wa.me link for a 10-digit Indian mobile, or any number already carrying its code. */
export const waLink = (mobile?: string | null, text = "") => {
  const d = String(mobile || "").replace(/\D/g, "");
  if (!d) return "";
  return `https://wa.me/${d.length === 10 ? `91${d}` : d}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
};
