import { useMutation, useQuery } from "@apollo/client";
import { ADD_QUOTATION, EDIT_QUOTATION, DELETE_QUOTATION, RESET_QUOTATION, SET_QUOTATION_STATUS, REVISE_QUOTATION } from "../../mutations/quotation";
import { GET_QUOTATIONS_PAGE, GET_QUOTATIONS, GET_DELETED_QUOTATIONS, GET_QUOTATION_BY_ID } from "../../queries/quotation";
import { useAppSelector } from "../../../redux/hooks";

export const QUOTATION_STATUS: Record<string, string> = {
  draft: "Draft", sent: "Sent", accepted: "Accepted", rejected: "Rejected", revised: "Revised", converted: "Converted",
};
/** "QT-000012" (or the device number offline), with " R1" for revisions. */
export const quotationNo = (q: any) => {
  const n = String(q?.billnumber || q?.offlineNumber || "");
  const base = n.startsWith("QT-") ? n : `QT-${n}`;
  return q?.revision ? `${base} R${q.revision}` : base;
};

const useBranchFilter = () => {
  const { type, branch, staff } = useAppSelector((s) => s.auth);
  const selectedBranchId = useAppSelector((s) => s.selectedBranch.branchId);
  const branchid = type === "admin" ? selectedBranchId : type === "branch" ? branch?.id : type === "staff" ? staff?.branchid?.id : undefined;
  return { branchid: branchid || undefined };
};

// Saving a quotation can move its lead to the Quotation stage.
const REFRESH = ["GetQuotationsPage", "GetQuotations", "GetDeletedQuotations", "GetQuotationById", "GetLeadsPage", "GetLeads", "GetLeadById"];

export const useQuotationMutations = () => {
  const opts = { refetchQueries: REFRESH };
  const [addQuotation] = useMutation(ADD_QUOTATION, opts);
  const [editQuotation] = useMutation(EDIT_QUOTATION, opts);
  const [deleteQuotation] = useMutation(DELETE_QUOTATION, opts);
  const [resetQuotation] = useMutation(RESET_QUOTATION, opts);
  const [setQuotationStatus] = useMutation(SET_QUOTATION_STATUS, opts);
  const [reviseQuotation] = useMutation(REVISE_QUOTATION, opts);
  return { addQuotation, editQuotation, deleteQuotation, resetQuotation, setQuotationStatus, reviseQuotation };
};

export const useQuotationsPageQuery = ({ page, pageSize, search, columnFilters = [] }: {
  page: number; pageSize: number; search: string; columnFilters?: { key: string; value: string }[]; [key: string]: any;
}) => {
  const filter = useBranchFilter();
  const { data, loading, refetch } = useQuery(GET_QUOTATIONS_PAGE, {
    variables: { filter, page, pageSize, search, columnFilters },
    fetchPolicy: "cache-and-network",
    notifyOnNetworkStatusChange: true,
  });
  return { items: data?.getQuotationsPage?.items ?? [], total: data?.getQuotationsPage?.total ?? 0, loading, refetch };
};

/** A lead's quotations (lead screen); read from the device offline. */
export const useQuotationsQuery = (leadid?: string | null, skip = false) => {
  const filter = { ...useBranchFilter(), ...(leadid ? { leadid } : {}) };
  return useQuery(GET_QUOTATIONS, { variables: { filter }, skip, fetchPolicy: "cache-and-network" });
};

export const useDeletedQuotationsQuery = () => {
  const filter = useBranchFilter();
  return useQuery(GET_DELETED_QUOTATIONS, { variables: { filter }, fetchPolicy: "cache-and-network" });
};

export const useQuotationByIdQuery = (id?: string | null) =>
  useQuery(GET_QUOTATION_BY_ID, { variables: { id }, skip: !id, fetchPolicy: "cache-and-network" });
