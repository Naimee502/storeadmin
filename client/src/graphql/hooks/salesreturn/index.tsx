import { useMutation, useQuery, type WatchQueryFetchPolicy } from "@apollo/client";
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
import { PAYMENT_SIDE_EFFECT_QUERIES } from "../shared/paymentsideeffects";

export const useSalesReturnMutations = () => {
  const { type, admin, branch, staff } = useAppSelector((s) => s.auth);
  const selectedBranchId = useAppSelector((s) => s.selectedBranch.branchId);
  const adminid = type === "admin" ? admin?.id : type === "branch" ? branch?.admin?.id : type === "staff" ? staff?.admin?.id : undefined;
  const branchid = type === "admin" ? selectedBranchId : type === "branch" ? branch?.id : type === "staff" ? staff?.branchid?.id : undefined;

  const [addSalesReturnMutation] = useMutation(ADD_SALES_RETURN, {
    refetchQueries: [
      { query: GET_SALES_RETURNS, variables: { filter: { adminid, branchid } } },
      ...PAYMENT_SIDE_EFFECT_QUERIES,
    ],
  });
  const [editSalesReturnMutation] = useMutation(EDIT_SALES_RETURN, {
    refetchQueries: [
      { query: GET_SALES_RETURNS, variables: { filter: { adminid, branchid } } },
      ...PAYMENT_SIDE_EFFECT_QUERIES,
    ],
  });
  const [deleteSalesReturnMutation] = useMutation(DELETE_SALES_RETURN, {
    refetchQueries: [
      { query: GET_SALES_RETURNS, variables: { filter: { adminid, branchid } } },
      { query: GET_DELETED_SALES_RETURNS, variables: { filter: { adminid, branchid } } },
      ...PAYMENT_SIDE_EFFECT_QUERIES,
    ],
  });
  const [resetSalesReturnMutation] = useMutation(RESET_SALES_RETURN, {
    refetchQueries: [
      { query: GET_SALES_RETURNS, variables: { filter: { adminid, branchid } } },
      { query: GET_DELETED_SALES_RETURNS, variables: { filter: { adminid, branchid } } },
      ...PAYMENT_SIDE_EFFECT_QUERIES,
    ],
  });
  return {
    addSalesReturnMutation,
    editSalesReturnMutation,
    deleteSalesReturnMutation,
    resetSalesReturnMutation,
  };
};

// Returns reduce an invoice's outstanding (see useOutstanding), and a return
// can be created moments before this list is read — so revalidate on mount.
export const useSalesReturnsQuery = (fetchPolicy: WatchQueryFetchPolicy = "cache-and-network") => {
  const { type, admin, branch, staff } = useAppSelector((s) => s.auth);
  const selectedBranchId = useAppSelector((s) => s.selectedBranch.branchId);
  const adminid = type === "admin" ? admin?.id : type === "branch" ? branch?.admin?.id : type === "staff" ? staff?.admin?.id : undefined;
  const branchid = type === "admin" ? selectedBranchId : type === "branch" ? branch?.id : type === "staff" ? staff?.branchid?.id : undefined;

  const { data, loading, error, refetch } = useQuery(GET_SALES_RETURNS, {
    variables: { filter: { adminid, branchid } },
    fetchPolicy,
  });
  return { data, loading, error, refetch };
};

export const useDeletedSalesReturnsQuery = () => {
  const { type, admin, branch, staff } = useAppSelector((s) => s.auth);
  const selectedBranchId = useAppSelector((s) => s.selectedBranch.branchId);
  const adminid = type === "admin" ? admin?.id : type === "branch" ? branch?.admin?.id : type === "staff" ? staff?.admin?.id : undefined;
  const branchid = type === "admin" ? selectedBranchId : type === "branch" ? branch?.id : type === "staff" ? staff?.branchid?.id : undefined;

  const { data, loading, error, refetch } = useQuery(GET_DELETED_SALES_RETURNS, {
    variables: { filter: { adminid, branchid } },
  });
  return { data, loading, error, refetch };
};

export const useSalesReturnByIDQuery = (id?: string) => {
  const { type, admin, branch, staff } = useAppSelector((s) => s.auth);
  const adminid = type === "admin" ? admin?.id : type === "branch" ? branch?.admin?.id : type === "staff" ? staff?.admin?.id : undefined;

  const { data, loading, error } = useQuery(GET_SALES_RETURN_BY_ID, {
    variables: { id, adminid },
    skip: !id,
  });
  return { data, loading, error };
};
