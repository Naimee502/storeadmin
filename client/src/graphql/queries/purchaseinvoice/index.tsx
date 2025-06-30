import { gql } from '@apollo/client';

export const GET_PURCHASE_INVOICES = gql`
  query GetPurchaseInvoices($adminId: ID, $branchid: ID) {
    getPurchaseInvoices(adminId: $adminId, branchid: $branchid) {
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
      admin {
        id
        name
        email
      }
    }
  }
`;

export const GET_DELETED_PURCHASE_INVOICES = gql`
 query GetDeletedPurchaseInvoices($adminId: ID, $branchid: ID) {
    getDeletedPurchaseInvoices(adminId: $adminId, branchid: $branchid) {
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
      admin {
        id
        name
        email
      }
    }
  }
`;

export const GET_PURCHASE_INVOICE_BY_ID = gql`
  query GetPurchaseInvoiceById($id: ID!, $adminId: ID) {
    getPurchaseInvoice(id: $id, adminId: $adminId) {
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
      admin {
        id
        name
        email
      }
    }
  }
`;
