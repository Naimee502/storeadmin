import { useMutation, useQuery } from "@apollo/client";
import {
  ADD_PURCHASE_RETURN,
  EDIT_PURCHASE_RETURN,
  DELETE_PURCHASE_RETURN,
  RESET_PURCHASE_RETURN,
} from "../../mutations/purchasereturn";
import {
  GET_PURCHASE_RETURNS,
  GET_PURCHASE_RETURN_BY_ID,
  GET_DELETED_PURCHASE_RETURNS,
} from "../../queries/purchasereturn";
import { useAppSelector } from "../../../redux/hooks";

export const usePurchaseReturnMutations = () => {
  const { type, admin, branch, staff } = useAppSelector((s) => s.auth);
  const selectedBranchId = useAppSelector((s) => s.selectedBranch.branchId);
  const adminid = type === "admin" ? admin?.id : type === "branch" ? branch?.admin?.id : type === "staff" ? staff?.admin?.id : undefined;
  const branchid = type === "admin" ? selectedBranchId : type === "branch" ? branch?.id : type === "staff" ? staff?.branchid?.id : undefined;

  const [addPurchaseReturnMutation] = useMutation(ADD_PURCHASE_RETURN, {
    refetchQueries: [
      { query: GET_PURCHASE_RETURNS, variables: { filter: { adminid, branchid } } },
    ],
  });
  const [editPurchaseReturnMutation] = useMutation(EDIT_PURCHASE_RETURN, {
    refetchQueries: [
      { query: GET_PURCHASE_RETURNS, variables: { filter: { adminid, branchid } } },
    ],
  });
  const [deletePurchaseReturnMutation] = useMutation(DELETE_PURCHASE_RETURN, {
    refetchQueries: [
      { query: GET_PURCHASE_RETURNS, variables: { filter: { adminid, branchid } } },
      { query: GET_DELETED_PURCHASE_RETURNS, variables: { filter: { adminid, branchid } } },
    ],
  });
  const [resetPurchaseReturnMutation] = useMutation(RESET_PURCHASE_RETURN, {
    refetchQueries: [
      { query: GET_PURCHASE_RETURNS, variables: { filter: { adminid, branchid } } },
      { query: GET_DELETED_PURCHASE_RETURNS, variables: { filter: { adminid, branchid } } },
    ],
  });
  return {
    addPurchaseReturnMutation,
    editPurchaseReturnMutation,
    deletePurchaseReturnMutation,
    resetPurchaseReturnMutation,
  };
};

export const usePurchaseReturnsQuery = () => {
  const { type, admin, branch, staff } = useAppSelector((s) => s.auth);
  const selectedBranchId = useAppSelector((s) => s.selectedBranch.branchId);
  const adminid = type === "admin" ? admin?.id : type === "branch" ? branch?.admin?.id : type === "staff" ? staff?.admin?.id : undefined;
  const branchid = type === "admin" ? selectedBranchId : type === "branch" ? branch?.id : type === "staff" ? staff?.branchid?.id : undefined;

  const { data, loading, error, refetch } = useQuery(GET_PURCHASE_RETURNS, {
    variables: { filter: { adminid, branchid } },
  });
  return { data, loading, error, refetch };
};

export const useDeletedPurchaseReturnsQuery = () => {
  const { type, admin, branch, staff } = useAppSelector((s) => s.auth);
  const selectedBranchId = useAppSelector((s) => s.selectedBranch.branchId);
  const adminid = type === "admin" ? admin?.id : type === "branch" ? branch?.admin?.id : type === "staff" ? staff?.admin?.id : undefined;
  const branchid = type === "admin" ? selectedBranchId : type === "branch" ? branch?.id : type === "staff" ? staff?.branchid?.id : undefined;

  const { data, loading, error, refetch } = useQuery(GET_DELETED_PURCHASE_RETURNS, {
    variables: { filter: { adminid, branchid } },
  });
  return { data, loading, error, refetch };
};

export const usePurchaseReturnByIDQuery = (id?: string) => {
  const { type, admin, branch, staff } = useAppSelector((s) => s.auth);
  const adminid = type === "admin" ? admin?.id : type === "branch" ? branch?.admin?.id : type === "staff" ? staff?.admin?.id : undefined;

  const { data, loading, error } = useQuery(GET_PURCHASE_RETURN_BY_ID, {
    variables: { id, adminid },
    skip: !id,
  });
  return { data, loading, error };
};
