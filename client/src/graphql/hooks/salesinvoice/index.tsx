import { useMutation, useQuery } from '@apollo/client';
import {
  ADD_SALES_INVOICE,
  EDIT_SALES_INVOICE,
  DELETE_SALES_INVOICE,
  RESET_SALES_INVOICE
} from '../../mutations/salesinvoice';

import {
  GET_SALES_INVOICES,
  GET_SALES_INVOICE_BY_ID,
  GET_DELETED_SALES_INVOICES
} from '../../queries/salesinvoice';
import { useAppSelector } from '../../../redux/hooks';

export const useSalesInvoiceMutations = () => {
  const [addSalesInvoiceMutation] = useMutation(ADD_SALES_INVOICE);
  const [editSalesInvoiceMutation] = useMutation(EDIT_SALES_INVOICE);
  const [deleteSalesInvoiceMutation] = useMutation(DELETE_SALES_INVOICE);
  const [resetSalesInvoiceMutation] = useMutation(RESET_SALES_INVOICE);

  return {
    addSalesInvoiceMutation,
    editSalesInvoiceMutation,
    deleteSalesInvoiceMutation,
    resetSalesInvoiceMutation
  };
};

export const useSalesInvoicesQuery = () => {
  const { type, admin, branch } = useAppSelector((state) => state.auth);
  const selectedBranchId = useAppSelector((state) => state.selectedBranch.branchId);
  
  const adminId = type === 'admin' ? admin?.id : branch?.admin?.id;
  const branchid = type === 'admin' ? selectedBranchId : branch?.id;

  const { data, loading, error, refetch } = useQuery(GET_SALES_INVOICES, {
    variables: { adminId, branchid },
  });

  return { data, loading, error, refetch };
};

export const useDeletedSalesInvoicesQuery = () => {
  const { type, admin, branch } = useAppSelector((state) => state.auth);
  const selectedBranchId = useAppSelector((state) => state.selectedBranch.branchId);
  
  const adminId = type === 'admin' ? admin?.id : branch?.admin?.id;
  const branchid = type === 'admin' ? selectedBranchId : branch?.id;
  
  const { data, loading, error, refetch } = useQuery(GET_DELETED_SALES_INVOICES, {
    variables: { adminId, branchid },
  });

  return { data, loading, error, refetch };
};

export const useSalesInvoiceByIDQuery = (id: string) => {
  const { type, admin, branch } = useAppSelector((state) => state.auth);

  const adminId = type === 'admin' ? admin?.id : branch?.admin?.id;

  const { data, loading, error } = useQuery(GET_SALES_INVOICE_BY_ID, {
    variables: { id, adminId },
    skip: !id,
  });
  return { data, loading, error };
};
