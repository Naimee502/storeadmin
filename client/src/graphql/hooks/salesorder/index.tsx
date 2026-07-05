import { useMutation, useQuery } from '@apollo/client';
import {
  ADD_SALES_ORDER,
  EDIT_SALES_ORDER,
  DELETE_SALES_ORDER,
  RESET_SALES_ORDER,
  CANCEL_SALES_ORDER,
  REOPEN_SALES_ORDER,
  CONFIRM_SALES_ORDER,
  MARK_SALES_ORDER_DISPATCHED,
  MARK_SALES_ORDER_DELIVERED,
} from '../../mutations/salesorder';

import {
  GET_SALES_ORDERS,
  GET_SALES_ORDER_BY_ID,
  GET_DELETED_SALES_ORDERS
} from '../../queries/salesorder';
import { useAppSelector } from '../../../redux/hooks';

// ----------------- Mutations -----------------
export const useSalesOrderMutations = () => {
  const [addSalesOrderMutation] = useMutation(ADD_SALES_ORDER);
  const [editSalesOrderMutation] = useMutation(EDIT_SALES_ORDER);
  const [deleteSalesOrderMutation] = useMutation(DELETE_SALES_ORDER);
  const [resetSalesOrderMutation] = useMutation(RESET_SALES_ORDER);
  const [cancelSalesOrderMutation] = useMutation(CANCEL_SALES_ORDER);
  const [reopenSalesOrderMutation] = useMutation(REOPEN_SALES_ORDER);
  const [confirmSalesOrderMutation] = useMutation(CONFIRM_SALES_ORDER);
  const [dispatchSalesOrderMutation] = useMutation(MARK_SALES_ORDER_DISPATCHED);
  const [deliverSalesOrderMutation] = useMutation(MARK_SALES_ORDER_DELIVERED);

  return {
    addSalesOrderMutation,
    editSalesOrderMutation,
    deleteSalesOrderMutation,
    resetSalesOrderMutation,
    cancelSalesOrderMutation,
    reopenSalesOrderMutation,
    confirmSalesOrderMutation,
    dispatchSalesOrderMutation,
    deliverSalesOrderMutation,
  };
};

// ----------------- Sales Orders Query -----------------
export const useSalesOrdersQuery = (extraFilter: Record<string, any> = {}) => {
  const { type, admin, branch, staff } = useAppSelector((state) => state.auth);
  const selectedBranchId = useAppSelector((state) => state.selectedBranch.branchId);

  const adminid = type === 'admin' ? admin?.id : type === 'branch' ? branch?.admin?.id : type === 'staff' ? staff?.admin?.id : undefined;
  const branchid = type === 'admin' ? selectedBranchId : type === 'branch' ? branch?.id : type === 'staff' ? staff?.branchid?.id : undefined;

  const { data, loading, error, refetch } = useQuery(GET_SALES_ORDERS, {
    variables: { filter: { adminid, branchid, ...extraFilter } },
  });

  return { data, loading, error, refetch };
};

// ----------------- Deleted Sales Orders Query -----------------
export const useDeletedSalesOrdersQuery = () => {
  const { type, admin, branch, staff } = useAppSelector((state) => state.auth);
  const selectedBranchId = useAppSelector((state) => state.selectedBranch.branchId);

  const adminid = type === 'admin' ? admin?.id : type === 'branch' ? branch?.admin?.id : type === 'staff' ? staff?.admin?.id : undefined;
  const branchid = type === 'admin' ? selectedBranchId : type === 'branch' ? branch?.id : type === 'staff' ? staff?.branchid?.id : undefined;

  const { data, loading, error, refetch } = useQuery(GET_DELETED_SALES_ORDERS, {
    variables: { filter: { adminid, branchid } },
  });

  return { data, loading, error, refetch };
};

// ----------------- Sales Order by ID Query -----------------
export const useSalesOrderByIDQuery = (id?: string) => {
  const { data, loading, error } = useQuery(GET_SALES_ORDER_BY_ID, {
    variables: { id },
    skip: !id,
  });

  return { data, loading, error };
};
