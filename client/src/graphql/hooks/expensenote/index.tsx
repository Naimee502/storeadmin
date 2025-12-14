import { useMutation, useQuery } from "@apollo/client";

import {
  ADD_EXPENSE_NOTE,
  EDIT_EXPENSE_NOTE,
  DELETE_EXPENSE_NOTE,
  RESET_EXPENSE_NOTE,
} from "../../mutations/expensenote";

import {
  GET_EXPENSE_NOTES,
  GET_EXPENSE_NOTE_BY_ID,
  GET_DELETED_EXPENSE_NOTES,
} from "../../queries/expensenote";

import { useAppSelector } from "../../../redux/hooks";

/* =========================
   MUTATIONS
   ========================= */

export const useExpenseNoteMutations = () => {
  const [addExpenseNoteMutation] = useMutation(ADD_EXPENSE_NOTE);
  const [editExpenseNoteMutation] = useMutation(EDIT_EXPENSE_NOTE);
  const [deleteExpenseNoteMutation] = useMutation(DELETE_EXPENSE_NOTE);
  const [resetExpenseNoteMutation] = useMutation(RESET_EXPENSE_NOTE);

  return {
    addExpenseNoteMutation,
    editExpenseNoteMutation,
    deleteExpenseNoteMutation,
    resetExpenseNoteMutation,
  };
};

/* =========================
   EXPENSE NOTES QUERY
   ========================= */

export const useExpenseNotesQuery = () => {
  const { type, admin, branch } = useAppSelector((state) => state.auth);
  const selectedBranchId = useAppSelector((state) => state.selectedBranch.branchId);

  const adminid = type === "admin" ? admin?.id : branch?.admin?.id;
  const branchid = type === "admin" ? selectedBranchId : branch?.id;

  const { data, loading, error, refetch } = useQuery(GET_EXPENSE_NOTES, {
    variables: { filter: { adminid, branchid } }, // ✅ wrapped in filter
  });

  return { data, loading, error, refetch };
};

/* =========================
   DELETED EXPENSE NOTES QUERY
   ========================= */

export const useDeletedExpenseNotesQuery = () => {
  const { type, admin, branch } = useAppSelector((state) => state.auth);
  const selectedBranchId = useAppSelector((state) => state.selectedBranch.branchId);

  const adminid = type === "admin" ? admin?.id : branch?.admin?.id;
  const branchid = type === "admin" ? selectedBranchId : branch?.id;

  const { data, loading, error, refetch } = useQuery(GET_DELETED_EXPENSE_NOTES, {
    variables: { filter: { adminid, branchid } }, // ✅ wrapped in filter
  });

  return { data, loading, error, refetch };
};

/* =========================
   EXPENSE NOTE BY ID QUERY
   ========================= */

export const useExpenseNoteByIDQuery = (id?: string) => {
  const { type, admin, branch } = useAppSelector((state) => state.auth);
  const adminid = type === "admin" ? admin?.id : branch?.admin?.id;

  const { data, loading, error } = useQuery(GET_EXPENSE_NOTE_BY_ID, {
    variables: { id, adminid }, // ✅ top-level, not in filter
    skip: !id,
  });

  return { data, loading, error };
};
