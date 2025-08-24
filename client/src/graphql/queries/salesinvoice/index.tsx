import { gql } from '@apollo/client';

// 🔹 Queries
export const GET_SALES_INVOICES = gql`
  query GetSalesInvoices($filter: SalesInvoiceFilterInput) {
    getSalesInvoices(filter: $filter) {
      id
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
      adminid
      branchid
      productservice {
        productserviceid
        variantid
        salesunitid
        gst
        qty
        rate
        amount
        discount
        salesaccountid
        purchaseaccountid
        serviceaccountid
      }
      isservice
      status
      createdAt
      updatedAt
    }
  }
`;

export const GET_DELETED_SALES_INVOICES = gql`
  query GetDeletedSalesInvoices($filter: SalesInvoiceFilterInput) {
    getDeletedSalesInvoices(filter: $filter) {
      id
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
      adminid
      branchid
      productservice {
        productserviceid
        variantid
        salesunitid
        gst
        qty
        rate
        amount
        discount
        salesaccountid
        purchaseaccountid
        serviceaccountid
      }
      isservice
      status
      createdAt
      updatedAt
    }
  }
`;

export const GET_SALES_INVOICE_BY_ID = gql`
  query getSalesInvoiceById($id: ID!, $adminid: ID) {
    getSalesInvoiceById(id: $id, adminid: $adminid) {
      id
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
      adminid
      branchid
      productservice {
        productserviceid
        variantid
        salesunitid
        gst
        qty
        rate
        amount
        discount
        salesaccountid
        purchaseaccountid
        serviceaccountid
      }
      isservice
      status
      createdAt
      updatedAt
    }
  }
`;
