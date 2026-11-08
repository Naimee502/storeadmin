import { useMemo } from 'react';
import { useMutation, useQuery, type WatchQueryFetchPolicy } from '@apollo/client';
import {
  ADD_SALES_INVOICE,
  EDIT_SALES_INVOICE,
  DELETE_SALES_INVOICE,
  RESET_SALES_INVOICE,
  CANCEL_SALES_INVOICE,
  REOPEN_SALES_INVOICE,
  MARK_SALES_INVOICE_DISPATCHED,
  MARK_SALES_INVOICE_DELIVERED,
} from '../../mutations/salesinvoice';

import {
  GET_SALES_INVOICES,
  GET_SALES_INVOICES_SETTLE,
  GET_SALES_INVOICES_LIST,
  GET_SALES_INVOICES_PAGE,
  GET_SALES_INVOICE_BY_ID,
  GET_DELETED_SALES_INVOICES
} from '../../queries/salesinvoice';
import { useAppSelector } from '../../../redux/hooks';
import { PAYMENT_SIDE_EFFECT_QUERIES } from '../shared/paymentsideeffects';

// Mutations: refetch Payment/Transaction caches, which the server updates with the invoice.
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
  // Cancelling moves stock and removes journal + receipt, so refresh the same caches.
  const [cancelSalesInvoiceMutation] = useMutation(CANCEL_SALES_INVOICE, {
    refetchQueries: PAYMENT_SIDE_EFFECT_QUERIES,
  });
  const [reopenSalesInvoiceMutation] = useMutation(REOPEN_SALES_INVOICE, {
    refetchQueries: PAYMENT_SIDE_EFFECT_QUERIES,
  });
  const [dispatchSalesInvoiceMutation] = useMutation(MARK_SALES_INVOICE_DISPATCHED);
  const [deliverSalesInvoiceMutation] = useMutation(MARK_SALES_INVOICE_DELIVERED);

  return {
    addSalesInvoiceMutation,
    editSalesInvoiceMutation,
    deleteSalesInvoiceMutation,
    resetSalesInvoiceMutation,
    cancelSalesInvoiceMutation,
    reopenSalesInvoiceMutation,
    dispatchSalesInvoiceMutation,
    deliverSalesInvoiceMutation,
  };
};

// Sales Invoices Query
/** Active sales invoices; cancelled bills only with { includeCancelled: true }. */
export const useSalesInvoicesQuery = (
  fetchPolicy?: WatchQueryFetchPolicy,
  opts?: { includeCancelled?: boolean }
) => {
  const { type, admin, branch, staff } = useAppSelector((state) => state.auth);
  const selectedBranchId = useAppSelector((state) => state.selectedBranch.branchId);

  const adminid = type === 'admin' ? admin?.id : type === 'branch' ? branch?.admin?.id : type === 'staff' ? staff?.admin?.id : undefined;
  const branchid = type === 'admin' ? selectedBranchId : type === 'branch' ? branch?.id : type === 'staff' ? staff?.branchid?.id : undefined;

  const { data: raw, loading, error, refetch } = useQuery(GET_SALES_INVOICES, {
    variables: { filter: { adminid, branchid } }, // ✅ wrap inside filter
    fetchPolicy,
  });

  const showCancelled = opts?.includeCancelled === true;
  const data = useMemo(() => {
    const list = raw?.getSalesInvoices;
    if (!list || showCancelled) return raw;
    return { ...raw, getSalesInvoices: list.filter((i: any) => i?.cancelStatus !== "cancelled") };
  }, [raw, showCancelled]);

  return { data, loading, error, refetch };
};

// Sales Invoices LIST (lite)
// Same filter as useSalesInvoicesQuery, but only the listing columns.
export const useSalesInvoicesListQuery = (
  fetchPolicy?: WatchQueryFetchPolicy,
  opts?: { includeCancelled?: boolean }
) => {
  const { type, admin, branch, staff } = useAppSelector((state) => state.auth);
  const selectedBranchId = useAppSelector((state) => state.selectedBranch.branchId);

  const adminid = type === 'admin' ? admin?.id : type === 'branch' ? branch?.admin?.id : type === 'staff' ? staff?.admin?.id : undefined;
  const branchid = type === 'admin' ? selectedBranchId : type === 'branch' ? branch?.id : type === 'staff' ? staff?.branchid?.id : undefined;

  const { data: raw, loading, error, refetch } = useQuery(GET_SALES_INVOICES_LIST, {
    variables: { filter: { adminid, branchid } },
    fetchPolicy,
  });

  const showCancelled = opts?.includeCancelled === true;
  const data = useMemo(() => {
    const list = raw?.getSalesInvoices;
    if (!list || showCancelled) return raw;
    return { ...raw, getSalesInvoices: list.filter((i: any) => i?.cancelStatus !== "cancelled") };
  }, [raw, showCancelled]);

  return { data, loading, error, refetch };
};

// Deleted Sales Invoices Query
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

// Sales Invoice by ID Query
export const useSalesInvoiceByIDQuery = (id?: string) => {
  const { type, admin, branch, staff } = useAppSelector((state) => state.auth);
  const adminid = type === 'admin' ? admin?.id : type === 'branch' ? branch?.admin?.id : type === 'staff' ? staff?.admin?.id : undefined;

  const { data, loading, error } = useQuery(GET_SALES_INVOICE_BY_ID, {
    variables: { id, adminid }, // ✅ Pass top-level, not inside filter
    skip: !id,
  });

  return { data, loading, error };
};

// Sales Invoices (settlement-lite, Payment form)
export const useSalesInvoicesSettleQuery = (fetchPolicy?: WatchQueryFetchPolicy) => {
  const { type, admin, branch, staff } = useAppSelector((state) => state.auth);
  const selectedBranchId = useAppSelector((state) => state.selectedBranch.branchId);

  const adminid = type === 'admin' ? admin?.id : type === 'branch' ? branch?.admin?.id : type === 'staff' ? staff?.admin?.id : undefined;
  const branchid = type === 'admin' ? selectedBranchId : type === 'branch' ? branch?.id : type === 'staff' ? staff?.branchid?.id : undefined;

  const { data: raw, loading, error, refetch } = useQuery(GET_SALES_INVOICES_SETTLE, {
    variables: { filter: { adminid, branchid } },
    fetchPolicy,
  });

  // Cancelled bills owe nothing — same default as the full query.
  const data = useMemo(() => {
    const list = raw?.getSalesInvoices;
    if (!list) return raw;
    return { ...raw, getSalesInvoices: list.filter((i: any) => i?.cancelStatus !== "cancelled") };
  }, [raw]);

  return { data, loading, error, refetch };
};

// Paged Sales Invoices (server-side pagination, search)
export const useSalesInvoicesPageQuery = ({
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

  const adminid = type === "admin" ? admin?.id : type === "branch" ? branch?.admin?.id : type === "staff" ? staff?.admin?.id : undefined;
  const branchid = type === "admin" ? selectedBranchId : type === "branch" ? branch?.id : type === "staff" ? staff?.branchid?.id : undefined;

  const { data, loading, error, refetch } = useQuery(GET_SALES_INVOICES_PAGE, {
    variables: { filter: { adminid, branchid, includeCancelled }, page, pageSize, search, columnFilters },
    fetchPolicy: "cache-and-network",
    notifyOnNetworkStatusChange: true,
  });

  return {
    items: data?.getSalesInvoicesPage?.items ?? [],
    total: data?.getSalesInvoicesPage?.total ?? 0,
    loading,
    error,
    refetch,
  };
};
