// src/hooks/graphql/paymentHooks.ts
import { useMutation, useQuery, useLazyQuery, type WatchQueryFetchPolicy } from "@apollo/client";
import {
  ADD_PAYMENT,
  EDIT_PAYMENT,
  DELETE_PAYMENT,
  RESET_PAYMENT,
  REALLOCATE_PAYMENT,
} from "../../mutations/payments";

import {
  GET_PAYMENTS,
  GET_PAYMENTS_LIST,
  GET_PAYMENTS_PAGE,
  GET_PAYMENT_BY_ID,
  GET_DELETED_PAYMENTS,
  GET_PARTY_OUTSTANDING_BILLS,
  PREVIEW_ALLOCATION,
} from "../../queries/payments";

import { useAppSelector } from "../../../redux/hooks";
import { PAYMENT_SIDE_EFFECT_QUERIES } from "../shared/paymentsideeffects";

// Mutations
export const usePaymentMutations = () => {
  const { type, admin, branch, staff } = useAppSelector((state) => state.auth);
  const selectedBranchId = useAppSelector((state) => state.selectedBranch.branchId);
  const adminid = type === "admin" ? admin?.id : type === "branch" ? branch?.admin?.id : type === "staff" ? staff?.admin?.id : undefined;
  const branchid = type === "admin" ? selectedBranchId : type === "branch" ? branch?.id : type === "staff" ? staff?.branchid?.id : undefined;

  // Refetch lists in the background; the saved payment is written into the list cache directly.
  const refreshLists = {
    refetchQueries: ["GetPaymentsList", "GetPaymentsPage", ...PAYMENT_SIDE_EFFECT_QUERIES],
    awaitRefetchQueries: false,
  };
  const listVars = { filter: { adminid, branchid } };

  const [addPaymentMutation] = useMutation(ADD_PAYMENT, {
    ...refreshLists,
    update(cache, { data }) {
      const created = data?.addPayment;
      if (!created) return;
      cache.updateQuery({ query: GET_PAYMENTS_LIST, variables: listVars }, (prev: any) => {
        if (!prev?.getPayments) return prev;
        if (prev.getPayments.some((p: any) => p.id === created.id)) return prev;
        // The list is oldest-first (the page reverses it), so append.
        return { ...prev, getPayments: [...prev.getPayments, created] };
      });
    },
  });
  const [editPaymentMutation] = useMutation(EDIT_PAYMENT, refreshLists);
  const [deletePaymentMutation] = useMutation(DELETE_PAYMENT, refreshLists);
  const [resetPaymentMutation] = useMutation(RESET_PAYMENT, {
    ...refreshLists,
    refetchQueries: [...refreshLists.refetchQueries, "GetDeletedPayments"],
  });
  const [reallocatePaymentMutation] = useMutation(REALLOCATE_PAYMENT, refreshLists);

  return {
    addPaymentMutation,
    editPaymentMutation,
    deletePaymentMutation,
    resetPaymentMutation,
    reallocatePaymentMutation,
  };
};

// Allocation preview (lazy), always fresh from the network.
export const usePreviewAllocationLazy = () => {
  const [run] = useLazyQuery(PREVIEW_ALLOCATION, { fetchPolicy: "network-only" });
  return run;
};

export const usePartyOutstandingBillsLazy = () => {
  const [run] = useLazyQuery(GET_PARTY_OUTSTANDING_BILLS, { fetchPolicy: "network-only" });
  return run;
};

// Payments Query: cache-and-network, since invoices/returns create payments server-side.
// Lite query for the Payments listing page only.
export const usePaymentsListQuery = (fetchPolicy: WatchQueryFetchPolicy = "cache-and-network") => {
  const { type, admin, branch, staff } = useAppSelector((state) => state.auth);
  const selectedBranchId = useAppSelector((state) => state.selectedBranch.branchId);

  const adminid = type === "admin" ? admin?.id : type === "branch" ? branch?.admin?.id : type === "staff" ? staff?.admin?.id : undefined;
  const branchid = type === "admin" ? selectedBranchId : type === "branch" ? branch?.id : type === "staff" ? staff?.branchid?.id : undefined;

  const { data, loading, error, refetch } = useQuery(GET_PAYMENTS_LIST, {
    variables: { filter: { adminid, branchid } },
    fetchPolicy,
  });

  return { data, loading, error, refetch };
};

export const usePaymentsQuery = (fetchPolicy: WatchQueryFetchPolicy = "cache-and-network") => {
  const { type, admin, branch, staff } = useAppSelector((state) => state.auth);
  const selectedBranchId = useAppSelector((state) => state.selectedBranch.branchId);

  const adminid = type === "admin" ? admin?.id : type === "branch" ? branch?.admin?.id : type === "staff" ? staff?.admin?.id : undefined;
  const branchid = type === "admin" ? selectedBranchId : type === "branch" ? branch?.id : type === "staff" ? staff?.branchid?.id : undefined;

  const { data, loading, error, refetch } = useQuery(GET_PAYMENTS, {
    variables: { filter: { adminid, branchid } }, // ✅ wrapped in filter
    fetchPolicy,
  });

  return { data, loading, error, refetch };
};

// Deleted Payments Query
export const useDeletedPaymentsQuery = () => {
  const { type, admin, branch, staff } = useAppSelector((state) => state.auth);
  const selectedBranchId = useAppSelector((state) => state.selectedBranch.branchId);

  const adminid = type === "admin" ? admin?.id : type === "branch" ? branch?.admin?.id : type === "staff" ? staff?.admin?.id : undefined;
  const branchid = type === "admin" ? selectedBranchId : type === "branch" ? branch?.id : type === "staff" ? staff?.branchid?.id : undefined;

  const { data, loading, error, refetch } = useQuery(GET_DELETED_PAYMENTS, {
    variables: { filter: { adminid, branchid } }, // ✅ wrapped in filter
  });

  return { data, loading, error, refetch };
};

// Payment by ID Query
export const usePaymentByIDQuery = (id?: string) => {
  const { type, admin, branch, staff } = useAppSelector((state) => state.auth);
  const adminid = type === "admin" ? admin?.id : type === "branch" ? branch?.admin?.id : type === "staff" ? staff?.admin?.id : undefined;

  const { data, loading, error } = useQuery(GET_PAYMENT_BY_ID, {
    variables: { id, adminid }, // ✅ top-level, not in filter
    skip: !id,
  });

  return { data, loading, error };
};

// Paged list (server-side paging, search and column filters)
export const usePaymentsPageQuery = ({
  page,
  pageSize,
  search,
  columnFilters = [],
}: {
  page: number;
  pageSize: number;
  search: string;
  columnFilters?: { key: string; value: string }[];
}) => {
  const { type, admin, branch, staff } = useAppSelector((state) => state.auth);
  const selectedBranchId = useAppSelector((state) => state.selectedBranch.branchId);

  const adminid = type === "admin" ? admin?.id : type === "branch" ? branch?.admin?.id : type === "staff" ? staff?.admin?.id : undefined;
  const branchid = type === "admin" ? selectedBranchId : type === "branch" ? branch?.id : type === "staff" ? staff?.branchid?.id : undefined;

  const { data, loading, error, refetch } = useQuery(GET_PAYMENTS_PAGE, {
    variables: { filter: { adminid, branchid }, page, pageSize, search, columnFilters },
    fetchPolicy: "cache-and-network",
    notifyOnNetworkStatusChange: true,
  });

  return {
    items: data?.getPaymentsPage?.items ?? [],
    total: data?.getPaymentsPage?.total ?? 0,
    loading,
    error,
    refetch,
  };
};
