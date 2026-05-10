import { useMutation, useQuery } from '@apollo/client';
import {
  ADD_PURCHASE_ORDER,
  EDIT_PURCHASE_ORDER,
  DELETE_PURCHASE_ORDER,
  RESET_PURCHASE_ORDER,
  CANCEL_PURCHASE_ORDER,
  REOPEN_PURCHASE_ORDER,
} from '../../mutations/purchaseorder';

import {
  GET_PURCHASE_ORDERS,
  GET_PURCHASE_ORDER_BY_ID,
  GET_DELETED_PURCHASE_ORDERS
} from '../../queries/purchaseorder';
import { useAppSelector } from '../../../redux/hooks';

// ----------------- Mutations -----------------
export const usePurchaseOrderMutations = () => {
  const [addPurchaseOrderMutation] = useMutation(ADD_PURCHASE_ORDER);
  const [editPurchaseOrderMutation] = useMutation(EDIT_PURCHASE_ORDER);
  const [deletePurchaseOrderMutation] = useMutation(DELETE_PURCHASE_ORDER);
  const [resetPurchaseOrderMutation] = useMutation(RESET_PURCHASE_ORDER);
  const [cancelPurchaseOrderMutation] = useMutation(CANCEL_PURCHASE_ORDER);
  const [reopenPurchaseOrderMutation] = useMutation(REOPEN_PURCHASE_ORDER);

  return {
    addPurchaseOrderMutation,
    editPurchaseOrderMutation,
    deletePurchaseOrderMutation,
    resetPurchaseOrderMutation,
    cancelPurchaseOrderMutation,
    reopenPurchaseOrderMutation,
  };
};

// ----------------- Purchase Orders Query -----------------
export const usePurchaseOrdersQuery = () => {
  const { type, admin, branch, staff } = useAppSelector((state) => state.auth);
  const selectedBranchId = useAppSelector((state) => state.selectedBranch.branchId);

  const adminid =
    type === 'admin'
      ? admin?.id
      : type === 'branch'
      ? branch?.admin?.id
      : type === 'staff'
      ? staff?.admin?.id
      : undefined;
  const branchid =
    type === 'branch'
      ? branch?.id
      : type === 'staff'
      ? staff?.branchid?.id
      : selectedBranchId;

  const { data, loading, error, refetch } = useQuery(GET_PURCHASE_ORDERS, {
    variables: { filter: { adminid, branchid } },
  });

  return { data, loading, error, refetch };
};

// ----------------- Deleted Purchase Orders Query -----------------
export const useDeletedPurchaseOrdersQuery = () => {
  const { type, admin, branch, staff } = useAppSelector((state) => state.auth);
  const selectedBranchId = useAppSelector((state) => state.selectedBranch.branchId);

  const adminid =
    type === 'admin'
      ? admin?.id
      : type === 'branch'
      ? branch?.admin?.id
      : type === 'staff'
      ? staff?.admin?.id
      : undefined;
  const branchid =
    type === 'branch'
      ? branch?.id
      : type === 'staff'
      ? staff?.branchid?.id
      : selectedBranchId;

  const { data, loading, error, refetch } = useQuery(GET_DELETED_PURCHASE_ORDERS, {
    variables: { filter: { adminid, branchid } },
  });

  return { data, loading, error, refetch };
};

// ----------------- Purchase Order by ID Query -----------------
export const usePurchaseOrderByIDQuery = (id?: string) => {
  const { data, loading, error } = useQuery(GET_PURCHASE_ORDER_BY_ID, {
    variables: { id },
    skip: !id,
  });

  return { data, loading, error };
};
