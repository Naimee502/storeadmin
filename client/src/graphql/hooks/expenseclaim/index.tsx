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

// The server scopes claims from the login + x-branch-id header; the branch is
// only passed as a variable so switching branches gives a fresh cache entry.
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

// Approving posts an Expense Note + its journal on the server, so the notes,
// payments and transactions lists must refetch too.
const AFTER_APPROVE = ["GetExpenseClaims", "GetExpenseNotes", ...PAYMENT_SIDE_EFFECT_QUERIES];

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
