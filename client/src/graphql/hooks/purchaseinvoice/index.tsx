import { useMutation, useQuery, type WatchQueryFetchPolicy } from '@apollo/client';
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
import { PAYMENT_SIDE_EFFECT_QUERIES } from '../shared/paymentsideeffects';

// ----------------- Mutations -----------------
// A purchase invoice auto-creates / updates / removes a Payment + Transaction
// on the server (PurchaseInvoice.adjustStockAndTransactions). Refetch those
// caches or Payments ▸ Add will keep showing the bill as outstanding.
export const usePurchaseInvoiceMutations = () => {
  const [addPurchaseInvoiceMutation] = useMutation(ADD_PURCHASE_INVOICE, {
    refetchQueries: PAYMENT_SIDE_EFFECT_QUERIES,
  });
  const [editPurchaseInvoiceMutation] = useMutation(EDIT_PURCHASE_INVOICE, {
    refetchQueries: PAYMENT_SIDE_EFFECT_QUERIES,
  });
  const [deletePurchaseInvoiceMutation] = useMutation(DELETE_PURCHASE_INVOICE, {
    refetchQueries: PAYMENT_SIDE_EFFECT_QUERIES,
  });
  const [resetPurchaseInvoiceMutation] = useMutation(RESET_PURCHASE_INVOICE, {
    refetchQueries: PAYMENT_SIDE_EFFECT_QUERIES,
  });

  return {
    addPurchaseInvoiceMutation,
    editPurchaseInvoiceMutation,
    deletePurchaseInvoiceMutation,
    resetPurchaseInvoiceMutation,
  };
};

// ----------------- Purchase Invoices Query -----------------
export const usePurchaseInvoicesQuery = (fetchPolicy?: WatchQueryFetchPolicy) => {
  const { type, admin, branch, staff } = useAppSelector((state) => state.auth);
  const selectedBranchId = useAppSelector((state) => state.selectedBranch.branchId);

  const adminid = type === 'admin' ? admin?.id : type === 'branch' ? branch?.admin?.id : type === 'staff' ? staff?.admin?.id : undefined;
  const branchid = type === 'admin' ? selectedBranchId : type === 'branch' ? branch?.id : type === 'staff' ? staff?.branchid?.id : undefined;

  const { data, loading, error, refetch } = useQuery(GET_PURCHASE_INVOICES, {
    variables: { filter: { adminid, branchid } }, // ✅ wrapped inside filter
    fetchPolicy,
  });

  return { data, loading, error, refetch };
};

// ----------------- Deleted Purchase Invoices Query -----------------
export const useDeletedPurchaseInvoicesQuery = () => {
  const { type, admin, branch, staff } = useAppSelector((state) => state.auth);
  const selectedBranchId = useAppSelector((state) => state.selectedBranch.branchId);

  const adminid = type === 'admin' ? admin?.id : type === 'branch' ? branch?.admin?.id : type === 'staff' ? staff?.admin?.id : undefined;
  const branchid = type === 'admin' ? selectedBranchId : type === 'branch' ? branch?.id : type === 'staff' ? staff?.branchid?.id : undefined;

  const { data, loading, error, refetch } = useQuery(GET_DELETED_PURCHASE_INVOICES, {
    variables: { filter: { adminid, branchid } }, // ✅ wrap inside filter
  });

  return { data, loading, error, refetch };
};

// ----------------- Purchase Invoice by ID Query -----------------
export const usePurchaseInvoiceByIDQuery = (id?: string) => {
  const { type, admin, branch, staff } = useAppSelector((state) => state.auth);
  const adminid = type === 'admin' ? admin?.id : type === 'branch' ? branch?.admin?.id : type === 'staff' ? staff?.admin?.id : undefined;

  const { data, loading, error } = useQuery(GET_PURCHASE_INVOICE_BY_ID, {
    variables: { id, adminid }, // ✅ top-level
    skip: !id,
  });

  return { data, loading, error };
};
