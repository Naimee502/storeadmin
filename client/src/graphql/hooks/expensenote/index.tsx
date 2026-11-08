import { useMutation, useQuery, useLazyQuery, type WatchQueryFetchPolicy } from "@apollo/client";

import {
  ADD_EXPENSE_NOTE,
  EDIT_EXPENSE_NOTE,
  DELETE_EXPENSE_NOTE,
  RESET_EXPENSE_NOTE,
} from "../../mutations/expensenote";

import {
  GET_EXPENSE_NOTES,
  GET_EXPENSE_NOTES_LIST,
  GET_EXPENSE_NOTES_PAGE,
  GET_EXPENSE_NOTE_BY_ID,
  GET_DELETED_EXPENSE_NOTES,
  GET_EXPENSE_CATEGORY_LEDGER,
} from "../../queries/expensenote";

import { useAppSelector } from "../../../redux/hooks";
import { PAYMENT_SIDE_EFFECT_QUERIES } from "../shared/paymentsideeffects";

// Mutations

// A credit expense note creates a Payment + Transaction server-side, so refetch those.
export const useExpenseNoteMutations = () => {
  const [addExpenseNoteMutation] = useMutation(ADD_EXPENSE_NOTE, {
    refetchQueries: PAYMENT_SIDE_EFFECT_QUERIES,
  });
  const [editExpenseNoteMutation] = useMutation(EDIT_EXPENSE_NOTE, {
    refetchQueries: PAYMENT_SIDE_EFFECT_QUERIES,
  });
  const [deleteExpenseNoteMutation] = useMutation(DELETE_EXPENSE_NOTE, {
    refetchQueries: PAYMENT_SIDE_EFFECT_QUERIES,
  });
  const [resetExpenseNoteMutation] = useMutation(RESET_EXPENSE_NOTE, {
    refetchQueries: PAYMENT_SIDE_EFFECT_QUERIES,
  });

  return {
    addExpenseNoteMutation,
    editExpenseNoteMutation,
    deleteExpenseNoteMutation,
    resetExpenseNoteMutation,
  };
};

// Expense notes query

export const useExpenseNotesQuery = (fetchPolicy?: WatchQueryFetchPolicy) => {
  const { type, admin, branch, staff } = useAppSelector((state) => state.auth);
  const selectedBranchId = useAppSelector((state) => state.selectedBranch.branchId);

  const adminid = type === "admin" ? admin?.id : type === "branch" ? branch?.admin?.id : type === "staff" ? staff?.admin?.id : undefined;
  const branchid = type === "admin" ? selectedBranchId : type === "branch" ? branch?.id : type === "staff" ? staff?.branchid?.id : undefined;

  const { data, loading, error, refetch } = useQuery(GET_EXPENSE_NOTES, {
    variables: { filter: { adminid, branchid } }, // ✅ wrapped in filter
    fetchPolicy,
  });

  return { data, loading, error, refetch };
};

// Expense notes list (lite), list page only

export const useExpenseNotesListQuery = (fetchPolicy?: WatchQueryFetchPolicy) => {
  const { type, admin, branch, staff } = useAppSelector((state) => state.auth);
  const selectedBranchId = useAppSelector((state) => state.selectedBranch.branchId);

  const adminid = type === "admin" ? admin?.id : type === "branch" ? branch?.admin?.id : type === "staff" ? staff?.admin?.id : undefined;
  const branchid = type === "admin" ? selectedBranchId : type === "branch" ? branch?.id : type === "staff" ? staff?.branchid?.id : undefined;

  const { data, loading, error, refetch } = useQuery(GET_EXPENSE_NOTES_LIST, {
    variables: { filter: { adminid, branchid } },
    fetchPolicy,
  });

  return { data, loading, error, refetch };
};

// Deleted expense notes query

export const useDeletedExpenseNotesQuery = () => {
  const { type, admin, branch, staff } = useAppSelector((state) => state.auth);
  const selectedBranchId = useAppSelector((state) => state.selectedBranch.branchId);

  const adminid = type === "admin" ? admin?.id : type === "branch" ? branch?.admin?.id : type === "staff" ? staff?.admin?.id : undefined;
  const branchid = type === "admin" ? selectedBranchId : type === "branch" ? branch?.id : type === "staff" ? staff?.branchid?.id : undefined;

  const { data, loading, error, refetch } = useQuery(GET_DELETED_EXPENSE_NOTES, {
    variables: { filter: { adminid, branchid } }, // ✅ wrapped in filter
  });

  return { data, loading, error, refetch };
};

// Expense note by id query

export const useExpenseNoteByIDQuery = (id?: string) => {
  const { type, admin, branch, staff } = useAppSelector((state) => state.auth);
  const adminid = type === "admin" ? admin?.id : type === "branch" ? branch?.admin?.id : type === "staff" ? staff?.admin?.id : undefined;

  const { data, loading, error } = useQuery(GET_EXPENSE_NOTE_BY_ID, {
    variables: { id, adminid }, // ✅ top-level, not in filter
    skip: !id,
  });

  return { data, loading, error };
};

// Category ledger (TA/DA, Salary): lazily fetched (or created) on category change

export const useExpenseCategoryLedgerLazy = () => {
  return useLazyQuery(GET_EXPENSE_CATEGORY_LEDGER);
};

// Paged list (server-side paging, search and column filters)
export const useExpenseNotesPageQuery = ({
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

  const { data, loading, error, refetch } = useQuery(GET_EXPENSE_NOTES_PAGE, {
    variables: { filter: { adminid, branchid }, page, pageSize, search, columnFilters },
    fetchPolicy: "cache-and-network",
    notifyOnNetworkStatusChange: true,
  });

  return {
    items: data?.getExpenseNotesPage?.items ?? [],
    total: data?.getExpenseNotesPage?.total ?? 0,
    loading,
    error,
    refetch,
  };
};
