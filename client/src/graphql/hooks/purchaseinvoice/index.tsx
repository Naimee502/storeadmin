import { useMutation, useQuery } from '@apollo/client';
import {
  ADD_PURCHASE_INVOICE,
  EDIT_PURCHASE_INVOICE,
  DELETE_PURCHASE_INVOICE,
  RESET_PURCHASE_INVOICE
} from '../../mutations/purchaseinvoice';
import {
  GET_PURCHASE_INVOICES,
  GET_PURCHASE_INVOICE_BY_ID,
  GET_DELETED_PURCHASE_INVOICES
} from '../../queries/purchaseinvoice';
import { useAppSelector } from '../../../redux/hooks';

// ----------------- Mutations -----------------
export const usePurchaseInvoiceMutations = () => {
  const [addPurchaseInvoiceMutation] = useMutation(ADD_PURCHASE_INVOICE);
  const [editPurchaseInvoiceMutation] = useMutation(EDIT_PURCHASE_INVOICE);
  const [deletePurchaseInvoiceMutation] = useMutation(DELETE_PURCHASE_INVOICE);
  const [resetPurchaseInvoiceMutation] = useMutation(RESET_PURCHASE_INVOICE);

  return {
    addPurchaseInvoiceMutation,
    editPurchaseInvoiceMutation,
    deletePurchaseInvoiceMutation,
    resetPurchaseInvoiceMutation,
  };
};

// ----------------- Purchase Invoices Query -----------------
export const usePurchaseInvoicesQuery = () => {
  const { type, admin, branch } = useAppSelector((state) => state.auth);
  const selectedBranchId = useAppSelector((state) => state.selectedBranch.branchId);

  const adminid = type === 'admin' ? admin?.id : branch?.admin?.id;
  const branchid = type === 'admin' ? selectedBranchId : branch?.id;

  const { data, loading, error, refetch } = useQuery(GET_PURCHASE_INVOICES, {
    variables: { filter: { adminid, branchid } }, // ✅ wrapped inside filter
  });

  return { data, loading, error, refetch };
};

// ----------------- Deleted Purchase Invoices Query -----------------
export const useDeletedPurchaseInvoicesQuery = () => {
  const { type, admin, branch } = useAppSelector((state) => state.auth);
  const selectedBranchId = useAppSelector((state) => state.selectedBranch.branchId);

  const adminid = type === 'admin' ? admin?.id : branch?.admin?.id;
  const branchid = type === 'admin' ? selectedBranchId : branch?.id;

  const { data, loading, error, refetch } = useQuery(GET_DELETED_PURCHASE_INVOICES, {
    variables: { filter: { adminid, branchid } }, // ✅ wrap inside filter
  });

  return { data, loading, error, refetch };
};

// ----------------- Purchase Invoice by ID Query -----------------
export const usePurchaseInvoiceByIDQuery = (id?: string) => {
  const { type, admin, branch } = useAppSelector((state) => state.auth);
  const adminid = type === 'admin' ? admin?.id : branch?.admin?.id;

  const { data, loading, error } = useQuery(GET_PURCHASE_INVOICE_BY_ID, {
    variables: { id, adminid }, // ✅ top-level
    skip: !id,
  });

  return { data, loading, error };
};
