import { useMemo } from 'react';
import { useMutation, useQuery, type WatchQueryFetchPolicy } from '@apollo/client';
import {
  ADD_PURCHASE_INVOICE,
  EDIT_PURCHASE_INVOICE,
  DELETE_PURCHASE_INVOICE,
  RESET_PURCHASE_INVOICE,
  CANCEL_PURCHASE_INVOICE,
  REOPEN_PURCHASE_INVOICE
} from '../../mutations/purchaseinvoice';
import {
  GET_PURCHASE_INVOICES,
  GET_PURCHASE_INVOICES_SETTLE,
  GET_PURCHASE_INVOICES_LIST,
  GET_PURCHASE_INVOICE_BY_ID,
  GET_DELETED_PURCHASE_INVOICES,
  GET_PURCHASE_INVOICES_PAGE
} from '../../queries/purchaseinvoice';
import { useAppSelector } from '../../../redux/hooks';
import { PAYMENT_SIDE_EFFECT_QUERIES } from '../shared/paymentsideeffects';

// Mutations: refetch Payment/Transaction caches, which the server updates with the invoice.
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
  // Cancelling moves stock and removes journal + payment, so refresh the same caches.
  const [cancelPurchaseInvoiceMutation] = useMutation(CANCEL_PURCHASE_INVOICE, {
    refetchQueries: PAYMENT_SIDE_EFFECT_QUERIES,
  });
  const [reopenPurchaseInvoiceMutation] = useMutation(REOPEN_PURCHASE_INVOICE, {
    refetchQueries: PAYMENT_SIDE_EFFECT_QUERIES,
  });

  return {
    addPurchaseInvoiceMutation,
    editPurchaseInvoiceMutation,
    deletePurchaseInvoiceMutation,
    resetPurchaseInvoiceMutation,
    cancelPurchaseInvoiceMutation,
    reopenPurchaseInvoiceMutation,
  };
};

// Purchase Invoices Query
/** Active purchase invoices; cancelled bills only with { includeCancelled: true }. */
export const usePurchaseInvoicesQuery = (
  fetchPolicy?: WatchQueryFetchPolicy,
  opts?: { includeCancelled?: boolean }
) => {
  const { type, admin, branch, staff } = useAppSelector((state) => state.auth);
  const selectedBranchId = useAppSelector((state) => state.selectedBranch.branchId);

  const adminid = type === 'admin' ? admin?.id : type === 'branch' ? branch?.admin?.id : type === 'staff' ? staff?.admin?.id : undefined;
  const branchid = type === 'admin' ? selectedBranchId : type === 'branch' ? branch?.id : type === 'staff' ? staff?.branchid?.id : undefined;

  const { data: raw, loading, error, refetch } = useQuery(GET_PURCHASE_INVOICES, {
    variables: { filter: { adminid, branchid } }, // ✅ wrapped inside filter
    fetchPolicy,
  });

  const showCancelled = opts?.includeCancelled === true;
  const data = useMemo(() => {
    const list = raw?.getPurchaseInvoices;
    if (!list || showCancelled) return raw;
    return { ...raw, getPurchaseInvoices: list.filter((i: any) => i?.cancelStatus !== "cancelled") };
  }, [raw, showCancelled]);

  return { data, loading, error, refetch };
};

// Deleted Purchase Invoices Query
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

// Purchase Invoice by ID Query
export const usePurchaseInvoiceByIDQuery = (id?: string) => {
  const { type, admin, branch, staff } = useAppSelector((state) => state.auth);
  const adminid = type === 'admin' ? admin?.id : type === 'branch' ? branch?.admin?.id : type === 'staff' ? staff?.admin?.id : undefined;

  const { data, loading, error } = useQuery(GET_PURCHASE_INVOICE_BY_ID, {
    variables: { id, adminid }, // ✅ top-level
    skip: !id,
  });

  return { data, loading, error };
};

// Purchase Invoices LIST (lite)
// Same filter as usePurchaseInvoicesQuery, but only the listing columns.
export const usePurchaseInvoicesListQuery = (
  fetchPolicy?: WatchQueryFetchPolicy,
  opts?: { includeCancelled?: boolean }
) => {
  const { type, admin, branch, staff } = useAppSelector((state) => state.auth);
  const selectedBranchId = useAppSelector((state) => state.selectedBranch.branchId);

  const adminid = type === 'admin' ? admin?.id : type === 'branch' ? branch?.admin?.id : type === 'staff' ? staff?.admin?.id : undefined;
  const branchid = type === 'admin' ? selectedBranchId : type === 'branch' ? branch?.id : type === 'staff' ? staff?.branchid?.id : undefined;

  const { data: raw, loading, error, refetch } = useQuery(GET_PURCHASE_INVOICES_LIST, {
    variables: { filter: { adminid, branchid } },
    fetchPolicy,
  });

  const showCancelled = opts?.includeCancelled === true;
  const data = useMemo(() => {
    const list = raw?.getPurchaseInvoices;
    if (!list || showCancelled) return raw;
    return { ...raw, getPurchaseInvoices: list.filter((i: any) => i?.cancelStatus !== "cancelled") };
  }, [raw, showCancelled]);

  return { data, loading, error, refetch };
};

// Purchase Invoices (settlement-lite, Payment form)
export const usePurchaseInvoicesSettleQuery = (fetchPolicy?: WatchQueryFetchPolicy) => {
  const { type, admin, branch, staff } = useAppSelector((state) => state.auth);
  const selectedBranchId = useAppSelector((state) => state.selectedBranch.branchId);

  const adminid = type === 'admin' ? admin?.id : type === 'branch' ? branch?.admin?.id : type === 'staff' ? staff?.admin?.id : undefined;
  const branchid = type === 'admin' ? selectedBranchId : type === 'branch' ? branch?.id : type === 'staff' ? staff?.branchid?.id : undefined;

  const { data: raw, loading, error, refetch } = useQuery(GET_PURCHASE_INVOICES_SETTLE, {
    variables: { filter: { adminid, branchid } },
    fetchPolicy,
  });

  // Cancelled bills owe nothing — same default as the full query.
  const data = useMemo(() => {
    const list = raw?.getPurchaseInvoices;
    if (!list) return raw;
    return { ...raw, getPurchaseInvoices: list.filter((i: any) => i?.cancelStatus !== "cancelled") };
  }, [raw]);

  return { data, loading, error, refetch };
};

// Purchase Invoices page (server paging, search and filters)
export const usePurchaseInvoicesPageQuery = ({
  page,
  pageSize,
  search,
  columnFilters = [],
  includeCancelled = false,
}: {
  page: number;
  pageSize: number;
  search: string;
  columnFilters?: { key: string; value: string }[];
  includeCancelled?: boolean;
}) => {
  const { type, admin, branch, staff } = useAppSelector((state) => state.auth);
  const selectedBranchId = useAppSelector((state) => state.selectedBranch.branchId);

  const adminid = type === 'admin' ? admin?.id : type === 'branch' ? branch?.admin?.id : type === 'staff' ? staff?.admin?.id : undefined;
  const branchid = type === 'admin' ? selectedBranchId : type === 'branch' ? branch?.id : type === 'staff' ? staff?.branchid?.id : undefined;

  const { data, loading, error, refetch } = useQuery(GET_PURCHASE_INVOICES_PAGE, {
    variables: { filter: { adminid, branchid, includeCancelled }, page, pageSize, search, columnFilters },
    fetchPolicy: 'cache-and-network',
    notifyOnNetworkStatusChange: true,
  });

  return {
    items: data?.getPurchaseInvoicesPage?.items ?? [],
    total: data?.getPurchaseInvoicesPage?.total ?? 0,
    loading,
    error,
    refetch,
  };
};
