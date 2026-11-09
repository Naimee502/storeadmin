import { useMutation, useQuery } from "@apollo/client";
import {
  ADD_DELIVERY_CHALLAN, EDIT_DELIVERY_CHALLAN, DELETE_DELIVERY_CHALLAN, RESET_DELIVERY_CHALLAN,
  MARK_DELIVERY_CHALLAN_DELIVERED, MARK_DELIVERY_CHALLAN_RETURNED,
} from "../../mutations/deliverychallan";
import {
  GET_DELIVERY_CHALLANS_PAGE, GET_DELETED_DELIVERY_CHALLANS, GET_DELIVERY_CHALLAN_BY_ID, GET_DELIVERY_CHALLAN_DRAFT,
} from "../../queries/deliverychallan";
import { useAppSelector } from "../../../redux/hooks";

// Branch the lists are scoped to; the business comes from the login on the server.
const useBranchFilter = () => {
  const { type, branch, staff } = useAppSelector((s) => s.auth);
  const selectedBranchId = useAppSelector((s) => s.selectedBranch.branchId);
  const branchid = type === "admin" ? selectedBranchId : type === "branch" ? branch?.id : type === "staff" ? staff?.branchid?.id : undefined;
  return { branchid: branchid || undefined };
};

// Challans move stock and order/invoice status, so those lists refresh too.
const REFRESH = ["GetDeliveryChallansPage", "GetDeletedDeliveryChallans", "GetSalesOrdersPage", "GetSalesInvoicesPage", "GetProductServices"];

export const useDeliveryChallanMutations = () => {
  const opts = { refetchQueries: REFRESH };
  const [addDeliveryChallanMutation] = useMutation(ADD_DELIVERY_CHALLAN, opts);
  const [editDeliveryChallanMutation] = useMutation(EDIT_DELIVERY_CHALLAN, opts);
  const [deleteDeliveryChallanMutation] = useMutation(DELETE_DELIVERY_CHALLAN, opts);
  const [resetDeliveryChallanMutation] = useMutation(RESET_DELIVERY_CHALLAN, opts);
  const [markDeliveredMutation] = useMutation(MARK_DELIVERY_CHALLAN_DELIVERED, opts);
  const [markReturnedMutation] = useMutation(MARK_DELIVERY_CHALLAN_RETURNED, opts);
  return {
    addDeliveryChallanMutation, editDeliveryChallanMutation, deleteDeliveryChallanMutation,
    resetDeliveryChallanMutation, markDeliveredMutation, markReturnedMutation,
  };
};

export const useDeliveryChallansPageQuery = ({ page, pageSize, search, columnFilters = [] }: {
  page: number; pageSize: number; search: string; columnFilters?: { key: string; value: string }[]; [key: string]: any;
}) => {
  const filter = useBranchFilter();
  const { data, loading, error, refetch } = useQuery(GET_DELIVERY_CHALLANS_PAGE, {
    variables: { filter, page, pageSize, search, columnFilters },
    fetchPolicy: "cache-and-network",
    notifyOnNetworkStatusChange: true,
  });
  return {
    items: data?.getDeliveryChallansPage?.items ?? [],
    total: data?.getDeliveryChallansPage?.total ?? 0,
    loading, error, refetch,
  };
};

export const useDeletedDeliveryChallansQuery = () => {
  const filter = useBranchFilter();
  return useQuery(GET_DELETED_DELIVERY_CHALLANS, { variables: { filter }, fetchPolicy: "cache-and-network" });
};

export const useDeliveryChallanByIdQuery = (id?: string | null) =>
  useQuery(GET_DELIVERY_CHALLAN_BY_ID, { variables: { id }, skip: !id, fetchPolicy: "cache-and-network" });

export const useDeliveryChallanDraftQuery = (sourceType?: string | null, sourceId?: string | null) =>
  useQuery(GET_DELIVERY_CHALLAN_DRAFT, { variables: { sourceType, sourceId }, skip: !sourceType || !sourceId, fetchPolicy: "network-only" });
