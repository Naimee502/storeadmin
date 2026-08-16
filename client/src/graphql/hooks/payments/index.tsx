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

// ----------------- Mutations -----------------
export const usePaymentMutations = () => {
  const [addPaymentMutation] = useMutation(ADD_PAYMENT);
  const [editPaymentMutation] = useMutation(EDIT_PAYMENT);
  const [deletePaymentMutation] = useMutation(DELETE_PAYMENT);
  const [resetPaymentMutation] = useMutation(RESET_PAYMENT);
  const [reallocatePaymentMutation] = useMutation(REALLOCATE_PAYMENT, {
    refetchQueries: ["GetPayments"],
  });

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
