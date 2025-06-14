import { gql } from '@apollo/client';

export const GET_SALES_INVOICES = gql`
  query GetSalesInvoices($branchid: String) {
    getSalesInvoices(branchid: $branchid) {
      id
      branchid
      salesmenid
      paymenttype
      partyacc
      taxorsupplytype
      billdate
      billtype
      billnumber
      notes
      invoicetype
      subtotal
      totaldiscount
      totalgst
      totalamount
      products {
        id
        gst
        qty
        rate
        amount
      }
      status
    }
  }
`;

export const GET_DELETED_SALES_INVOICES = gql`
  query GetDeletedSalesInvoices($branchid: String) {
    getDeletedSalesInvoices(branchid: $branchid) {
      id
      branchid
      salesmenid
      paymenttype
      partyacc
      taxorsupplytype
      billdate
      billtype
      billnumber
      notes
      invoicetype
      subtotal
      totaldiscount
      totalgst
      totalamount
      products {
        id
        gst
        qty
        rate
        amount
      }
      status
    }
  }
`;

export const GET_SALES_INVOICE_BY_ID = gql`
  query GetSalesInvoiceById($id: ID!) {
    getSalesInvoice(id: $id) {
      id
      branchid
      salesmenid
      paymenttype
      partyacc
      taxorsupplytype
      billdate
      billtype
      billnumber
      notes
      invoicetype
      subtotal
      totaldiscount
      totalgst
      totalamount
      products {
        id
        gst
        qty
        rate
        amount
      }
      status
    }
  }
`;
