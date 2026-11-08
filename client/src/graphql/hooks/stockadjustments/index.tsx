import { useQuery, useMutation } from "@apollo/client";
import type { WatchQueryFetchPolicy } from "@apollo/client";
import {
  GET_STOCK_ADJUSTMENTS,
  GET_STOCK_ADJUSTMENTS_LIST,
  GET_STOCK_ADJUSTMENTS_PAGE,
  GET_STOCK_ADJUSTMENT_PRODUCTS,
  GET_STOCK_ADJUSTMENT_BY_ID,
} from "../../queries/stockadjustments";
import { useAppSelector } from "../../../redux/hooks";
import {
  CREATE_STOCK_ADJUSTMENT,
  UPDATE_STOCK_ADJUSTMENT,
  DELETE_STOCK_ADJUSTMENT,
  CANCEL_STOCK_ADJUSTMENT,
  RESET_STOCK_ADJUSTMENT,
} from "../../mutations/stockadjustments";

export const useGetStockAdjustments = (filter: any = {}, limit: number = 0, offset: number = 0) => {
  const { data, loading, error, refetch } = useQuery(GET_STOCK_ADJUSTMENTS, {
    variables: { filter, limit, offset },
    fetchPolicy: "network-only",
  });
  return { data, loading, error, refetch };
};

// Active entries (status = true)
export const useActiveStockAdjustments = (filter: any = {}) =>
  useGetStockAdjustments({ ...filter, status: true });

// Deleted entries (status = false)
export const useDeletedStockAdjustments = (filter: any = {}) =>
  useGetStockAdjustments({ ...filter, status: false });

// Stock Adjustments LIST (lite)
// Active entries for the list page only — same filter as
// useActiveStockAdjustments, but the GET_STOCK_ADJUSTMENTS_LIST selection and
// the default (cache-first) policy so a return visit paints from cache while
// the page refreshes in the background.
export const useStockAdjustmentsListQuery = (
  filter: any = {},
  fetchPolicy?: WatchQueryFetchPolicy
) => {
  const { data, loading, error, refetch } = useQuery(GET_STOCK_ADJUSTMENTS_LIST, {
    variables: { filter: { ...filter, status: true }, limit: 0, offset: 0 },
    fetchPolicy,
  });
  return { data, loading, error, refetch };
};

// Product picker for the add/edit form
// Same scope/variables as useProductServicesQuery (products hook), lite
// GET_STOCK_ADJUSTMENT_PRODUCTS selection. Result is under getProductServices.
export const useStockAdjustmentProductsQuery = (
  status: boolean = true,
  limit: number = 0,
  offset: number = 0
) => {
  const { type, admin, branch, staff } = useAppSelector((state) => state.auth);
  const selectedBranchId = useAppSelector((state) => state.selectedBranch.branchId);

  const adminId =
    type === 'admin' ? admin?.id : type === 'branch' ? branch?.admin?.id : type === 'staff' ? staff?.admin?.id : undefined;
  const branchid =
    type === 'admin' ? selectedBranchId : type === 'branch' ? branch?.id : type === 'staff' ? staff?.branchid?.id : undefined;

  const { data, loading, error, refetch } = useQuery(GET_STOCK_ADJUSTMENT_PRODUCTS, {
    variables: { filter: { adminid: adminId, branchid, status }, limit, offset },
    skip: !adminId,
    fetchPolicy: 'cache-and-network',
  });
  return { data, loading, error, refetch };
};

export const useGetStockAdjustmentById = (id: string, adminId?: string, branchId?: string) => {
  const { data, loading, error, refetch } = useQuery(GET_STOCK_ADJUSTMENT_BY_ID, {
    variables: { id, adminId, branchId },
    skip: !id,
    fetchPolicy: "network-only",
  });
  return { data, loading, error, refetch };
};

// Refetch whichever stock-adjustment lists are mounted, with their own
// variables. `{ query: GET_STOCK_ADJUSTMENTS }` without variables fired an
// extra request for every adjustment of every admin/branch.
const STOCK_ADJUSTMENT_LIST_QUERIES = ["GetStockAdjustments", "GetStockAdjustmentsList", "GetStockAdjustmentsPage"];

export const useCreateStockAdjustment = () => {
  const [createStockAdjustment, { loading, error }] = useMutation(CREATE_STOCK_ADJUSTMENT, {
    refetchQueries: STOCK_ADJUSTMENT_LIST_QUERIES,
  });
  return { createStockAdjustment, loading, error };
};

export const useUpdateStockAdjustment = () => {
  const [updateStockAdjustment, { loading, error }] = useMutation(UPDATE_STOCK_ADJUSTMENT, {
    refetchQueries: STOCK_ADJUSTMENT_LIST_QUERIES,
  });
  return { updateStockAdjustment, loading, error };
};

export const useDeleteStockAdjustment = () => {
  const [deleteStockAdjustment, { loading, error }] = useMutation(DELETE_STOCK_ADJUSTMENT, {
    refetchQueries: STOCK_ADJUSTMENT_LIST_QUERIES,
  });
  return { deleteStockAdjustment, loading, error };
};

export const useCancelStockAdjustment = () => {
  const [cancelStockAdjustment, { loading, error }] = useMutation(CANCEL_STOCK_ADJUSTMENT, {
    refetchQueries: STOCK_ADJUSTMENT_LIST_QUERIES,
  });
  return { cancelStockAdjustment, loading, error };
};

export const useResetStockAdjustment = () => {
  const [resetStockAdjustment, { loading, error }] = useMutation(RESET_STOCK_ADJUSTMENT, {
    refetchQueries: STOCK_ADJUSTMENT_LIST_QUERIES,
  });
  return { resetStockAdjustment, loading, error };
};

// Paged list (server-side paging, search and column filters)
export const useStockAdjustmentsPageQuery = ({
  page,
  pageSize,
  search,
  columnFilters = [],
  filter = {},
}: {
  page: number;
  pageSize: number;
  search: string;
  columnFilters?: { key: string; value: string }[];
  filter?: any;
}) => {
  const { data, loading, error, refetch } = useQuery(GET_STOCK_ADJUSTMENTS_PAGE, {
    variables: { filter: { ...filter, status: true }, page, pageSize, search, columnFilters },
    fetchPolicy: "cache-and-network",
    notifyOnNetworkStatusChange: true,
  });

  return {
    items: data?.getStockAdjustmentsPage?.items ?? [],
    total: data?.getStockAdjustmentsPage?.total ?? 0,
    loading,
    error,
    refetch,
  };
};
