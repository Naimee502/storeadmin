import { useMutation, useQuery } from "@apollo/client";
import { GET_EXPENSE_CLAIMS, GET_DELETED_EXPENSE_CLAIMS } from "../../queries/expenseclaim";
import {
  APPROVE_EXPENSE_CLAIM,
  REJECT_EXPENSE_CLAIM,
  DELETE_EXPENSE_CLAIM,
  RESET_EXPENSE_CLAIM,
} from "../../mutations/expenseclaim";
import { useAppSelector } from "../../../redux/hooks";
import { PAYMENT_SIDE_EFFECT_QUERIES } from "../shared/paymentsideeffects";

// Server scopes by login + branch header; branch var just splits the cache.
export const useExpenseClaimsQuery = (skip = false) => {
  const selectedBranchId = useAppSelector((state) => state.selectedBranch.branchId);
  return useQuery(GET_EXPENSE_CLAIMS, {
    variables: { filter: { branchid: selectedBranchId || undefined } },
    fetchPolicy: "cache-and-network",
    skip,
  });
};

export const useDeletedExpenseClaimsQuery = () => {
  const selectedBranchId = useAppSelector((state) => state.selectedBranch.branchId);
  return useQuery(GET_DELETED_EXPENSE_CLAIMS, {
    variables: { filter: { branchid: selectedBranchId || undefined } },
    fetchPolicy: "cache-and-network",
  });
};

// Approving posts an Expense Note + journal, so refetch those lists too.
const AFTER_APPROVE = ["GetExpenseClaims", "GetExpenseNotes", "GetExpenseNotesList", "GetExpenseNotesPage", ...PAYMENT_SIDE_EFFECT_QUERIES];

export const useExpenseClaimMutations = () => {
  const [approveExpenseClaimMutation] = useMutation(APPROVE_EXPENSE_CLAIM, { refetchQueries: AFTER_APPROVE });
  const [rejectExpenseClaimMutation] = useMutation(REJECT_EXPENSE_CLAIM, { refetchQueries: ["GetExpenseClaims"] });
  const [deleteExpenseClaimMutation] = useMutation(DELETE_EXPENSE_CLAIM, {
    refetchQueries: ["GetExpenseClaims", "GetDeletedExpenseClaims"],
  });
  const [resetExpenseClaimMutation] = useMutation(RESET_EXPENSE_CLAIM, {
    refetchQueries: ["GetExpenseClaims", "GetDeletedExpenseClaims"],
  });
  return { approveExpenseClaimMutation, rejectExpenseClaimMutation, deleteExpenseClaimMutation, resetExpenseClaimMutation };
};
