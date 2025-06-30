import { gql } from '@apollo/client';

export const GET_SALES_INVOICES = gql`
  query GetSalesInvoices($adminId: ID, $branchid: String) {
    getSalesInvoices(adminId: $adminId, branchid: $branchid) {
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

export const GET_DELETED_SALES_INVOICES = gql`
  query GetDeletedSalesInvoices($adminId: ID, $branchid: String) {
    getDeletedSalesInvoices(adminId: $adminId, branchid: $branchid) {
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

export const GET_SALES_INVOICE_BY_ID = gql`
  query GetSalesInvoiceById($id: ID!, $adminId: ID) {
    getSalesInvoice(id: $id, adminId: $adminId) {
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
