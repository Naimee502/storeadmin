import { useMutation, useQuery, type WatchQueryFetchPolicy } from '@apollo/client';
import {
  ADD_SALES_INVOICE,
  EDIT_SALES_INVOICE,
  DELETE_SALES_INVOICE,
  RESET_SALES_INVOICE,
  MARK_SALES_INVOICE_DISPATCHED,
  MARK_SALES_INVOICE_DELIVERED,
} from '../../mutations/salesinvoice';

import {
  GET_SALES_INVOICES,
  GET_SALES_INVOICE_BY_ID,
  GET_DELETED_SALES_INVOICES
} from '../../queries/salesinvoice';
import { useAppSelector } from '../../../redux/hooks';
import { PAYMENT_SIDE_EFFECT_QUERIES } from '../shared/paymentsideeffects';

// ----------------- Mutations -----------------
// A sales invoice auto-creates / updates / removes a Payment + Transaction on
// the server (SalesInvoice.adjustStockAndTransactions). Refetch those caches or
// Payments ▸ Add will keep showing the invoice as outstanding.
export const useSalesInvoiceMutations = () => {
  const [addSalesInvoiceMutation] = useMutation(ADD_SALES_INVOICE, {
    refetchQueries: PAYMENT_SIDE_EFFECT_QUERIES,
  });
  const [editSalesInvoiceMutation] = useMutation(EDIT_SALES_INVOICE, {
    refetchQueries: PAYMENT_SIDE_EFFECT_QUERIES,
  });
  const [deleteSalesInvoiceMutation] = useMutation(DELETE_SALES_INVOICE, {
    refetchQueries: PAYMENT_SIDE_EFFECT_QUERIES,
  });
  const [resetSalesInvoiceMutation] = useMutation(RESET_SALES_INVOICE, {
    refetchQueries: PAYMENT_SIDE_EFFECT_QUERIES,
  });
  const [dispatchSalesInvoiceMutation] = useMutation(MARK_SALES_INVOICE_DISPATCHED);
  const [deliverSalesInvoiceMutation] = useMutation(MARK_SALES_INVOICE_DELIVERED);

  return {
    addSalesInvoiceMutation,
    editSalesInvoiceMutation,
    deleteSalesInvoiceMutation,
    resetSalesInvoiceMutation,
    dispatchSalesInvoiceMutation,
    deliverSalesInvoiceMutation,
  };
};

// ----------------- Sales Invoices Query -----------------
export const useSalesInvoicesQuery = (fetchPolicy?: WatchQueryFetchPolicy) => {
  const { type, admin, branch, staff } = useAppSelector((state) => state.auth);
  const selectedBranchId = useAppSelector((state) => state.selectedBranch.branchId);

  const adminid = type === 'admin' ? admin?.id : type === 'branch' ? branch?.admin?.id : type === 'staff' ? staff?.admin?.id : undefined;
  const branchid = type === 'admin' ? selectedBranchId : type === 'branch' ? branch?.id : type === 'staff' ? staff?.branchid?.id : undefined;

  const { data, loading, error, refetch } = useQuery(GET_SALES_INVOICES, {
    variables: { filter: { adminid, branchid } }, // ✅ wrap inside filter
    fetchPolicy,
  });

  return { data, loading, error, refetch };
};

// ----------------- Deleted Sales Invoices Query -----------------
export const useDeletedSalesInvoicesQuery = () => {
  const { type, admin, branch, staff } = useAppSelector((state) => state.auth);
  const selectedBranchId = useAppSelector((state) => state.selectedBranch.branchId);

  const adminid = type === 'admin' ? admin?.id : type === 'branch' ? branch?.admin?.id : type === 'staff' ? staff?.admin?.id : undefined;
  const branchid = type === 'admin' ? selectedBranchId : type === 'branch' ? branch?.id : type === 'staff' ? staff?.branchid?.id : undefined;

  const { data, loading, error, refetch } = useQuery(GET_DELETED_SALES_INVOICES, {
    variables: { filter: { adminid, branchid } }, // ✅ wrap inside filter
  });

  return { data, loading, error, refetch };
};

// ----------------- Sales Invoice by ID Query -----------------
export const useSalesInvoiceByIDQuery = (id?: string) => {
  const { type, admin, branch, staff } = useAppSelector((state) => state.auth);
  const adminid = type === 'admin' ? admin?.id : type === 'branch' ? branch?.admin?.id : type === 'staff' ? staff?.admin?.id : undefined;

  const { data, loading, error } = useQuery(GET_SALES_INVOICE_BY_ID, {
    variables: { id, adminid }, // ✅ Pass top-level, not inside filter
    skip: !id,
  });

  return { data, loading, error };
};
