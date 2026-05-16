// src/hooks/graphql/paymentHooks.ts
import { useMutation, useQuery } from "@apollo/client";
import {
  ADD_PAYMENT,
  EDIT_PAYMENT,
  DELETE_PAYMENT,
  RESET_PAYMENT,
} from "../../mutations/payments";

import {
  GET_PAYMENTS,
  GET_PAYMENT_BY_ID,
  GET_DELETED_PAYMENTS,
} from "../../queries/payments";

import { useAppSelector } from "../../../redux/hooks";

// ----------------- Mutations -----------------
export const usePaymentMutations = () => {
  const [addPaymentMutation] = useMutation(ADD_PAYMENT);
  const [editPaymentMutation] = useMutation(EDIT_PAYMENT);
  const [deletePaymentMutation] = useMutation(DELETE_PAYMENT);
  const [resetPaymentMutation] = useMutation(RESET_PAYMENT);

  return {
    addPaymentMutation,
    editPaymentMutation,
    deletePaymentMutation,
    resetPaymentMutation,
  };
};

// ----------------- Payments Query -----------------
export const usePaymentsQuery = () => {
  const { type, admin, branch, staff } = useAppSelector((state) => state.auth);
  const selectedBranchId = useAppSelector((state) => state.selectedBranch.branchId);

  const adminid = type === "admin" ? admin?.id : type === "branch" ? branch?.admin?.id : type === "staff" ? staff?.admin?.id : undefined;
  const branchid = type === "admin" ? selectedBranchId : type === "branch" ? branch?.id : type === "staff" ? staff?.branchid?.id : undefined;

  const { data, loading, error, refetch } = useQuery(GET_PAYMENTS, {
    variables: { filter: { adminid, branchid } }, // ✅ wrapped in filter
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
