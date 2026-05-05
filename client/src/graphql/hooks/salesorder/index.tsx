import { useMutation, useQuery } from '@apollo/client';
import {
  ADD_SALES_ORDER,
  EDIT_SALES_ORDER,
  DELETE_SALES_ORDER,
  RESET_SALES_ORDER
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

  return {
    addSalesOrderMutation,
    editSalesOrderMutation,
    deleteSalesOrderMutation,
    resetSalesOrderMutation
  };
};

// ----------------- Sales Orders Query -----------------
export const useSalesOrdersQuery = () => {
  const { type, admin, branch } = useAppSelector((state) => state.auth);
  const selectedBranchId = useAppSelector((state) => state.selectedBranch.branchId);

  const adminid = type === 'admin' ? admin?.id : branch?.admin?.id;
  const branchid = type === 'admin' ? selectedBranchId : branch?.id;

  const { data, loading, error, refetch } = useQuery(GET_SALES_ORDERS, {
    variables: { filter: { adminid, branchid } },
  });

  return { data, loading, error, refetch };
};

// ----------------- Deleted Sales Orders Query -----------------
export const useDeletedSalesOrdersQuery = () => {
  const { type, admin, branch } = useAppSelector((state) => state.auth);
  const selectedBranchId = useAppSelector((state) => state.selectedBranch.branchId);

  const adminid = type === 'admin' ? admin?.id : branch?.admin?.id;
  const branchid = type === 'admin' ? selectedBranchId : branch?.id;

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
