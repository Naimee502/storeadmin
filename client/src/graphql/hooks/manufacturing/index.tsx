import { useMutation, useQuery } from "@apollo/client";
import * as M from "../../mutations/manufacturing";
import * as Q from "../../queries/manufacturing";
import { useAppSelector } from "../../../redux/hooks";

export const WORK_STATUS: Record<string, string> = { planned: "Planned", inprogress: "In Progress", completed: "Completed", cancelled: "Cancelled" };
export const QC_STATUS: Record<string, string> = { pass: "Pass", fail: "Fail", hold: "On Hold" };
/** "WO-000012" (or the device number offline). */
export const mfgNo = (d: any, prefix: "WO-" | "PE-") => {
  const n = String(d?.billnumber || d?.offlineNumber || "");
  return n.startsWith(prefix) ? n : `${prefix}${n}`;
};

export const useMfgBranch = () => {
  const { type, branch, staff } = useAppSelector((s) => s.auth);
  const selectedBranchId = useAppSelector((s) => s.selectedBranch.branchId);
  const branchid = type === "admin" ? selectedBranchId : type === "branch" ? branch?.id : type === "staff" ? staff?.branchid?.id : undefined;
  return branchid || undefined;
};

// Production moves stock, so stock screens refresh too.
const REFRESH = [
  "GetBoms", "GetBomsPage", "GetDeletedBoms", "GetBomById", "GetWorkOrders", "GetWorkOrdersPage", "GetDeletedWorkOrders", "GetWorkOrderById",
  "GetProductionEntries", "GetProductionEntriesPage", "GetDeletedProductionEntries", "GetProductionEntryById", "GetProductServices",
];

export const useManufacturingMutations = () => {
  const opts = { refetchQueries: REFRESH };
  const [addBom] = useMutation(M.ADD_BOM, opts);
  const [editBom] = useMutation(M.EDIT_BOM, opts);
  const [deleteBom] = useMutation(M.DELETE_BOM, opts);
  const [resetBom] = useMutation(M.RESET_BOM, opts);
  const [addWorkOrder] = useMutation(M.ADD_WORK_ORDER, opts);
  const [editWorkOrder] = useMutation(M.EDIT_WORK_ORDER, opts);
  const [setWorkOrderStatus] = useMutation(M.SET_WORK_ORDER_STATUS, opts);
  const [deleteWorkOrder] = useMutation(M.DELETE_WORK_ORDER, opts);
  const [resetWorkOrder] = useMutation(M.RESET_WORK_ORDER, opts);
  const [addProductionEntry] = useMutation(M.ADD_PRODUCTION_ENTRY, opts);
  const [editProductionEntry] = useMutation(M.EDIT_PRODUCTION_ENTRY, opts);
  const [deleteProductionEntry] = useMutation(M.DELETE_PRODUCTION_ENTRY, opts);
  const [resetProductionEntry] = useMutation(M.RESET_PRODUCTION_ENTRY, opts);
  return {
    addBom, editBom, deleteBom, resetBom,
    addWorkOrder, editWorkOrder, setWorkOrderStatus, deleteWorkOrder, resetWorkOrder,
    addProductionEntry, editProductionEntry, deleteProductionEntry, resetProductionEntry,
  };
};

const live = { fetchPolicy: "cache-and-network" as const };
export const useBomsQuery = () => useQuery(Q.GET_BOMS, live);
export const useDeletedBomsQuery = () => useQuery(Q.GET_DELETED_BOMS, live);
export const useBomByIdQuery = (id?: string | null) => useQuery(Q.GET_BOM_BY_ID, { variables: { id }, skip: !id, ...live });

export const useWorkOrdersQuery = (dates: { billdateFrom?: string; billdateTo?: string } = {}) => {
  const branchid = useMfgBranch();
  return useQuery(Q.GET_WORK_ORDERS, { variables: { filter: { branchid, ...dates } }, ...live });
};
export const useDeletedWorkOrdersQuery = () => {
  const branchid = useMfgBranch();
  return useQuery(Q.GET_DELETED_WORK_ORDERS, { variables: { filter: { branchid } }, ...live });
};
export const useWorkOrderByIdQuery = (id?: string | null) => useQuery(Q.GET_WORK_ORDER_BY_ID, { variables: { id }, skip: !id, ...live });

export const useProductionEntriesQuery = (dates: { billdateFrom?: string; billdateTo?: string } = {}) => {
  const branchid = useMfgBranch();
  return useQuery(Q.GET_PRODUCTION_ENTRIES, { variables: { filter: { branchid, ...dates } }, ...live });
};
export const useDeletedProductionEntriesQuery = () => {
  const branchid = useMfgBranch();
  return useQuery(Q.GET_DELETED_PRODUCTION_ENTRIES, { variables: { filter: { branchid } }, ...live });
};
export const useProductionEntryByIdQuery = (id?: string | null) =>
  useQuery(Q.GET_PRODUCTION_ENTRY_BY_ID, { variables: { id }, skip: !id, ...live });

type PageVars = { page: number; pageSize: number; search: string; columnFilters?: { key: string; value: string }[]; [key: string]: any };
const pageOpts = (variables: any) => ({ variables, fetchPolicy: "cache-and-network" as const, notifyOnNetworkStatusChange: true });

export const useBomsPageQuery = ({ page, pageSize, search, columnFilters = [] }: PageVars) => {
  const { data, loading, refetch } = useQuery(Q.GET_BOMS_PAGE, pageOpts({ page, pageSize, search, columnFilters }));
  return { items: data?.getBomsPage?.items ?? [], total: data?.getBomsPage?.total ?? 0, loading, refetch };
};
export const useWorkOrdersPageQuery = ({ page, pageSize, search, columnFilters = [] }: PageVars) => {
  const branchid = useMfgBranch();
  const { data, loading, refetch } = useQuery(Q.GET_WORK_ORDERS_PAGE, pageOpts({ filter: { branchid }, page, pageSize, search, columnFilters }));
  return { items: data?.getWorkOrdersPage?.items ?? [], total: data?.getWorkOrdersPage?.total ?? 0, loading, refetch };
};
export const useProductionEntriesPageQuery = ({ page, pageSize, search, columnFilters = [] }: PageVars) => {
  const branchid = useMfgBranch();
  const { data, loading, refetch } = useQuery(Q.GET_PRODUCTION_ENTRIES_PAGE, pageOpts({ filter: { branchid }, page, pageSize, search, columnFilters }));
  return { items: data?.getProductionEntriesPage?.items ?? [], total: data?.getProductionEntriesPage?.total ?? 0, loading, refetch };
};
