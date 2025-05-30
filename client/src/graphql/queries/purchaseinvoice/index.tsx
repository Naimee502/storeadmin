import { gql } from '@apollo/client';

export const GET_PURCHASE_INVOICES = gql`
  query GetPurchaseInvoices {
    getPurchaseInvoices {
      id
      branchid
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

export const GET_PURCHASE_INVOICE_BY_ID = gql`
  query GetPurchaseInvoiceById($id: ID!) {
    getPurchaseInvoice(id: $id) {
      id
      branchid
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
