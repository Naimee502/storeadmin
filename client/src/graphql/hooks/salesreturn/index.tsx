import { useMutation, useQuery } from "@apollo/client";
import {
  ADD_SALES_RETURN,
  EDIT_SALES_RETURN,
  DELETE_SALES_RETURN,
  RESET_SALES_RETURN,
} from "../../mutations/salesreturn";
import {
  GET_SALES_RETURNS,
  GET_SALES_RETURN_BY_ID,
  GET_DELETED_SALES_RETURNS,
} from "../../queries/salesreturn";
import { useAppSelector } from "../../../redux/hooks";

export const useSalesReturnMutations = () => {
  const [addSalesReturnMutation] = useMutation(ADD_SALES_RETURN);
  const [editSalesReturnMutation] = useMutation(EDIT_SALES_RETURN);
  const [deleteSalesReturnMutation] = useMutation(DELETE_SALES_RETURN);
  const [resetSalesReturnMutation] = useMutation(RESET_SALES_RETURN);
  return {
    addSalesReturnMutation,
    editSalesReturnMutation,
    deleteSalesReturnMutation,
    resetSalesReturnMutation,
  };
};

export const useSalesReturnsQuery = () => {
  const { type, admin, branch } = useAppSelector((s) => s.auth);
  const selectedBranchId = useAppSelector((s) => s.selectedBranch.branchId);
  const adminid = type === "admin" ? admin?.id : branch?.admin?.id;
  const branchid = type === "admin" ? selectedBranchId : branch?.id;

  const { data, loading, error, refetch } = useQuery(GET_SALES_RETURNS, {
    variables: { filter: { adminid, branchid } },
  });
  return { data, loading, error, refetch };
};

export const useDeletedSalesReturnsQuery = () => {
  const { type, admin, branch } = useAppSelector((s) => s.auth);
  const selectedBranchId = useAppSelector((s) => s.selectedBranch.branchId);
  const adminid = type === "admin" ? admin?.id : branch?.admin?.id;
  const branchid = type === "admin" ? selectedBranchId : branch?.id;

  const { data, loading, error, refetch } = useQuery(GET_DELETED_SALES_RETURNS, {
    variables: { filter: { adminid, branchid } },
  });
  return { data, loading, error, refetch };
};

export const useSalesReturnByIDQuery = (id?: string) => {
  const { type, admin, branch } = useAppSelector((s) => s.auth);
  const adminid = type === "admin" ? admin?.id : branch?.admin?.id;

  const { data, loading, error } = useQuery(GET_SALES_RETURN_BY_ID, {
    variables: { id, adminid },
    skip: !id,
  });
  return { data, loading, error };
};
