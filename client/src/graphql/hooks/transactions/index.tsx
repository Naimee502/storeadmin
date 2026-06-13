// src/hooks/graphql/transactionHooks.ts
import { useMutation, useQuery, useLazyQuery } from "@apollo/client";
import {
  ADD_TRANSACTION,
  EDIT_TRANSACTION,
  DELETE_TRANSACTION,
  RESET_TRANSACTION,
} from "../../mutations/transactions";

import {
  GET_TRANSACTIONS,
  GET_TRANSACTION_BY_ID,
  GET_DELETED_TRANSACTIONS,
  PREVIEW_INVOICE_JOURNAL,
} from "../../queries/transactions";

import { useAppSelector } from "../../../redux/hooks";

// ----------------- Mutations -----------------
export const useTransactionMutations = () => {
  const [addTransactionMutation] = useMutation(ADD_TRANSACTION);
  const [editTransactionMutation] = useMutation(EDIT_TRANSACTION);
  const [deleteTransactionMutation] = useMutation(DELETE_TRANSACTION);
  const [resetTransactionMutation] = useMutation(RESET_TRANSACTION);

  return {
    addTransactionMutation,
    editTransactionMutation,
    deleteTransactionMutation,
    resetTransactionMutation,
  };
};

// ----------------- Invoice Journal Preview (lazy) -----------------
export const usePreviewInvoiceJournalLazy = () => {
  const [fetchPreview] = useLazyQuery(PREVIEW_INVOICE_JOURNAL, {
    fetchPolicy: "network-only",
  });
  return fetchPreview;
};

// ----------------- Transactions Query -----------------
export const useTransactionsQuery = () => {
  const { type, admin, branch, staff } = useAppSelector((state) => state.auth);
  const selectedBranchId = useAppSelector((state) => state.selectedBranch.branchId);

  const adminid = type === "admin" ? admin?.id : type === "branch" ? branch?.admin?.id : type === "staff" ? staff?.admin?.id : undefined;
  const branchid = type === "admin" ? selectedBranchId : type === "branch" ? branch?.id : type === "staff" ? staff?.branchid?.id : undefined;

  const { data, loading, error, refetch } = useQuery(GET_TRANSACTIONS, {
    variables: { filter: { adminid, branchid } }, // ✅ wrapped in filter
  });

  return { data, loading, error, refetch };
};

// ----------------- Deleted Transactions Query -----------------
export const useDeletedTransactionsQuery = () => {
  const { type, admin, branch, staff } = useAppSelector((state) => state.auth);
  const selectedBranchId = useAppSelector((state) => state.selectedBranch.branchId);

  const adminid = type === "admin" ? admin?.id : type === "branch" ? branch?.admin?.id : type === "staff" ? staff?.admin?.id : undefined;
  const branchid = type === "admin" ? selectedBranchId : type === "branch" ? branch?.id : type === "staff" ? staff?.branchid?.id : undefined;

  const { data, loading, error, refetch } = useQuery(GET_DELETED_TRANSACTIONS, {
    variables: { filter: { adminid, branchid } }, // ✅ wrapped in filter
  });

  return { data, loading, error, refetch };
};

// ----------------- Transaction by ID Query -----------------
export const useTransactionByIDQuery = (id?: string) => {
  const { type, admin, branch, staff } = useAppSelector((state) => state.auth);
  const adminid = type === "admin" ? admin?.id : type === "branch" ? branch?.admin?.id : type === "staff" ? staff?.admin?.id : undefined;

  const { data, loading, error } = useQuery(GET_TRANSACTION_BY_ID, {
    variables: { id, adminid }, // ✅ top-level, not in filter
    skip: !id,
  });

  return { data, loading, error };
};
