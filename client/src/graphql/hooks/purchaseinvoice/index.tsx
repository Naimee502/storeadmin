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

export const usePurchaseInvoicesQuery = (branchid?: string) => {
  const { data, loading, error, refetch } = useQuery(GET_PURCHASE_INVOICES, {
    variables: { branchid },
  });

  return { data, loading, error, refetch };
};

export const useDeletedPurchaseInvoicesQuery = (branchid?: string) => {
  const { data, loading, error, refetch } = useQuery(GET_DELETED_PURCHASE_INVOICES, {
    variables: { branchid },
  });

  return { data, loading, error, refetch };
};

export const usePurchaseInvoiceByIDQuery = (id: string) => {
  const { data, loading, error } = useQuery(GET_PURCHASE_INVOICE_BY_ID, {
    variables: { id },
    skip: !id,
  });
  return { data, loading, error };
};


