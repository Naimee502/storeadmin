import { useMutation, useQuery } from "@apollo/client";
import { ADD_SERVICE, DELETE_SERVICE, RESET_SERVICE, UPDATE_SERVICE } from "../../mutations/services";
import { GET_SERVICES_PAGE, GET_SERVICE_BY_ID } from "../../queries/services";
import { useAppSelector } from "../../../redux/hooks";

export const PRICING_UNITS = [
  { value: "fixed", label: "Fixed Price" },
  { value: "visit", label: "Per Visit" },
  { value: "hour", label: "Per Hour" },
  { value: "session", label: "Per Session" },
  { value: "unit", label: "Per Unit / Machine" },
  { value: "room", label: "Per Room" },
  { value: "sqft", label: "Per Sq Ft" },
];

const REFRESH = ["GetServicesPage", "GetServiceById", "GetProductServices", "GetProductServicesPage"];

export const useServiceMasterMutations = () => {
  const opts = { refetchQueries: REFRESH };
  const [addService] = useMutation(ADD_SERVICE, opts);
  const [updateService] = useMutation(UPDATE_SERVICE, opts);
  const [deleteService] = useMutation(DELETE_SERVICE, opts);
  const [resetService] = useMutation(RESET_SERVICE, opts);
  return { addService, updateService, deleteService, resetService };
};

const useTenantFilter = () => {
  const { type, admin, branch, staff } = useAppSelector((s) => s.auth);
  const selectedBranchId = useAppSelector((s) => s.selectedBranch.branchId);
  const adminid = type === "admin" ? admin?.id : type === "branch" ? branch?.admin?.id : staff?.admin?.id;
  const branchid = type === "admin" ? selectedBranchId : type === "branch" ? branch?.id : staff?.branchid?.id;
  return { adminid, branchid: branchid || undefined };
};

export const useServicesPageQuery = (
  { page, pageSize, search, columnFilters = [] }: { page: number; pageSize: number; search: string; columnFilters?: { key: string; value: string }[]; [k: string]: any },
  status = true
) => {
  // isservice also keeps the offline (device) page to services.
  const filter = { ...useTenantFilter(), status, isservice: true };
  const { data, loading, refetch } = useQuery(GET_SERVICES_PAGE, {
    variables: { filter, page, pageSize, search, columnFilters },
    skip: !filter.adminid,
    fetchPolicy: "cache-and-network",
    notifyOnNetworkStatusChange: true,
  });
  return { items: data?.getServicesPage?.items ?? [], total: data?.getServicesPage?.total ?? 0, loading, refetch };
};

export const useServiceByIdQuery = (id?: string | null) =>
  useQuery(GET_SERVICE_BY_ID, { variables: { id }, skip: !id, fetchPolicy: "cache-and-network" });
