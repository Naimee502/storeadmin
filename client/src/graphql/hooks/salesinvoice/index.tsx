import { useMutation, useQuery } from '@apollo/client';
import {
  ADD_SALES_INVOICE,
  EDIT_SALES_INVOICE,
  DELETE_SALES_INVOICE
} from '../../mutations/salesinvoice';
import {
  GET_SALES_INVOICES,
  GET_SALES_INVOICE_BY_ID
} from '../../queries/salesinvoice';

export const useSalesInvoiceMutations = () => {
  const [addSalesInvoiceMutation] = useMutation(ADD_SALES_INVOICE);
  const [editSalesInvoiceMutation] = useMutation(EDIT_SALES_INVOICE);
  const [deleteSalesInvoiceMutation] = useMutation(DELETE_SALES_INVOICE);

  return { addSalesInvoiceMutation, editSalesInvoiceMutation, deleteSalesInvoiceMutation };
};

export const useSalesInvoicesQuery = () => {
  const { data, loading, error, refetch } = useQuery(GET_SALES_INVOICES);

  return { data, loading, error, refetch };
};

export const useSalesInvoiceByIDQuery = (id: string) => {
  const { data, loading, error } = useQuery(GET_SALES_INVOICE_BY_ID, {
    variables: { id },
    skip: !id, // skip if no ID
  });

  return { data, loading, error };
};
