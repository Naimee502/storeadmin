import { gql } from '@apollo/client';

export const GET_PURCHASE_INVOICES = gql`
  query GetPurchaseInvoices($branchid: String) {
    getPurchaseInvoices(branchid: $branchid) {
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
        productid
        gst
        qty
        rate
        amount
        discount  
      }
      status
    }
  }
`;

export const GET_DELETED_PURCHASE_INVOICES = gql`
 query GetDeletedPurchaseInvoices($branchid: String) {
    getDeletedPurchaseInvoices(branchid: $branchid) {
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
        productid
        gst
        qty
        rate
        amount
        discount  
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
        productid
        gst
        qty
        rate
        amount
        discount  
      }
      status
    }
  }
`;
