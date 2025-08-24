import { gql } from '@apollo/client';

// 🔹 Queries
export const GET_PURCHASE_INVOICES = gql`
  query GetPurchaseInvoices($filter: PurchaseInvoiceFilterInput) {
    getPurchaseInvoices(filter: $filter) {
      id
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
        purchaseunitid
        gst
        qty
        rate
        amount
        discount
        purchaseaccountid
        salesaccountid
        serviceaccountid
      }
      isservice
      status
      createdAt
      updatedAt
    }
  }
`;

export const GET_DELETED_PURCHASE_INVOICES = gql`
  query GetDeletedPurchaseInvoices($filter: PurchaseInvoiceFilterInput) {
    getDeletedPurchaseInvoices(filter: $filter) {
      id
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
        purchaseunitid
        gst
        qty
        rate
        amount
        discount
        purchaseaccountid
        salesaccountid
        serviceaccountid
      }
      isservice
      status
      createdAt
      updatedAt
    }
  }
`;

export const GET_PURCHASE_INVOICE_BY_ID = gql`
  query GetPurchaseInvoiceById($id: ID!, $adminid: ID) {
    getPurchaseInvoiceById(id: $id, adminid: $adminid) {
      id
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
        gst
        qty
        rate
        amount
        discount
        purchaseaccountid
        salesaccountid
        serviceaccountid
      }
      isservice
      status
      createdAt
      updatedAt
    }
  }
`;
