import { gql } from '@apollo/client';

// 🔹 Queries
export const GET_PURCHASE_INVOICES = gql`
  query GetPurchaseInvoices($filter: PurchaseInvoiceFilterInput) {
    getPurchaseInvoices(filter: $filter) {
      id
      paymenttype
      partyacc {
        id
        accountname
        mobile
      }
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
        productserviceid { id name }
        variantid { id name }
        purchaseunitid { id unitname }
        gst
        qty
        rate
        amount
        discount
        salesaccountid { id ledgername }
        purchaseaccountid { id ledgername }
        serviceaccountid { id ledgername }
      }
      isservice
      createdby_id
      createdby_name
      createdby_type
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
      partyacc {
        id
        accountname
        mobile
      }
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
        productserviceid { id name }
        variantid { id name }
        purchaseunitid { id unitname }
        gst
        qty
        rate
        amount
        discount
        salesaccountid { id ledgername }
        purchaseaccountid { id ledgername }
        serviceaccountid { id ledgername }
      }
      isservice
      createdby_id
      createdby_name
      createdby_type
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
      partyacc {
        id
        accountname
        mobile
      }
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
        productserviceid { id name }
        variantid { id name }
        purchaseunitid { id unitname }
        gst
        qty
        rate
        amount
        discount
        salesaccountid { id ledgername }
        purchaseaccountid { id ledgername }
        serviceaccountid { id ledgername }
      }
      isservice
      createdby_id
      createdby_name
      createdby_type
      status
      createdAt
      updatedAt
    }
  }
`;
