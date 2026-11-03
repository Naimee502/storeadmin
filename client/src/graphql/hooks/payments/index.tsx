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
  GET_PAYMENT_BY_ID,
  GET_DELETED_PAYMENTS,
  GET_PARTY_OUTSTANDING_BILLS,
  PREVIEW_ALLOCATION,
} from "../../queries/payments";

import { useAppSelector } from "../../../redux/hooks";
import { PAYMENT_SIDE_EFFECT_QUERIES } from "../shared/paymentsideeffects";

// ----------------- Mutations -----------------
// Every payment write refreshes the Payments list BEFORE the mutation resolves.
//
// The visible bug: save a payment, land back on Payments, and the new entry
// isn't there until a manual browser refresh. The list is opened straight
// after the save with the OLD cached rows (cache-and-network), and on a large
// business (~2000 payments) the background re-fetch takes long enough that the
// user decides the entry is missing.
//
// Refetching by operation NAME alone isn't enough here: Apollo only refetches
// ACTIVE queries by name, and the Payments list isn't mounted while the form is
// open. So the list's exact query (same filter it will use) is refetched by
// document, and awaited, so the cache is already fresh when the form navigates
// back. The name-based entries still catch any other mounted GetPayments /
// GetTransactions watcher (Home activity table, reports, other filters).
export const usePaymentMutations = () => {
  const { type, admin, branch, staff } = useAppSelector((state) => state.auth);
  const selectedBranchId = useAppSelector((state) => state.selectedBranch.branchId);
  const adminid = type === "admin" ? admin?.id : type === "branch" ? branch?.admin?.id : type === "staff" ? staff?.admin?.id : undefined;
  const branchid = type === "admin" ? selectedBranchId : type === "branch" ? branch?.id : type === "staff" ? staff?.branchid?.id : undefined;

  const refreshLists = {
    refetchQueries: [
      { query: GET_PAYMENTS, variables: { filter: { adminid, branchid } } },
      ...PAYMENT_SIDE_EFFECT_QUERIES,
    ],
    awaitRefetchQueries: true,
  };

  const [addPaymentMutation] = useMutation(ADD_PAYMENT, refreshLists);
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

// ----------------- Allocation preview (lazy) -----------------
// "network-only": the whole point is a fresh, race-free view of what the
// party still owes at the moment the user presses Save.
export const usePreviewAllocationLazy = () => {
  const [run] = useLazyQuery(PREVIEW_ALLOCATION, { fetchPolicy: "network-only" });
  return run;
};

export const usePartyOutstandingBillsLazy = () => {
  const [run] = useLazyQuery(GET_PARTY_OUTSTANDING_BILLS, { fetchPolicy: "network-only" });
  return run;
};

// ----------------- Payments Query -----------------
// Defaults to "cache-and-network": payments are created as a SERVER-side side
// effect of sales/purchase invoices, returns and expense notes, so Apollo's
// cache goes stale without the client ever issuing a payment mutation. The
// outstanding-invoice list is derived from this data, so a stale read shows
// already-settled invoices as still payable.
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

// ----------------- Deleted Payments Query -----------------
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

// ----------------- Payment by ID Query -----------------
export const usePaymentByIDQuery = (id?: string) => {
  const { type, admin, branch, staff } = useAppSelector((state) => state.auth);
  const adminid = type === "admin" ? admin?.id : type === "branch" ? branch?.admin?.id : type === "staff" ? staff?.admin?.id : undefined;

  const { data, loading, error } = useQuery(GET_PAYMENT_BY_ID, {
    variables: { id, adminid }, // ✅ top-level, not in filter
    skip: !id,
  });

  return { data, loading, error };
};
