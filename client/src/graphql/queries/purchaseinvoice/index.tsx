import { gql } from '@apollo/client';

// 🔹 Queries
export const GET_PURCHASE_INVOICES = gql`
  query GetPurchaseInvoices($filter: PurchaseInvoiceFilterInput) {
    getPurchaseInvoices(filter: $filter) {
      id
      branchid
      adminid
      paymenttype
      partyacc {
        id
        accountname
        mobile
        address
        city
        state
        gstnumber
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
      productservice {
        productserviceid { id name }
        variantid { id name }
        purchaseunitid { id unitname }
        unitqty
        gst
        qty
        rate
        amount
        discount
        salesaccountid { id ledgername }
        purchaseaccountid { id ledgername }
        serviceaccountid { id ledgername }
      }
      othercharges {
        ledgerid { id ledgername }
        amount
        gstpercent
        gstamount
        totalamount
        remarks
      }
      deliverydate
      duedate
      transportname
      vehiclenumber
      ewaybillno
      distance
      roundoff
      invoicediscount
      invoicediscounttype
      isservice
      sourceorderid
      sourceorderno
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
      branchid
      adminid
      paymenttype
      partyacc {
        id
        accountname
        mobile
        address
        city
        state
        gstnumber
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
      productservice {
        productserviceid { id name }
        variantid { id name }
        purchaseunitid { id unitname }
        unitqty
        gst
        qty
        rate
        amount
        discount
        salesaccountid { id ledgername }
        purchaseaccountid { id ledgername }
        serviceaccountid { id ledgername }
      }
      othercharges {
        ledgerid { id ledgername }
        amount
        gstpercent
        gstamount
        totalamount
        remarks
      }
      deliverydate
      duedate
      transportname
      vehiclenumber
      ewaybillno
      distance
      roundoff
      invoicediscount
      invoicediscounttype
      isservice
      sourceorderid
      sourceorderno
      createdby_id
      createdby_name
      createdby_type
      status
      createdAt
      updatedAt
    }
  }
`;

// Lightweight, print-only lookup — the party's running balance is expensive
// to compute (sums every unsettled bill for the party), so it's fetched only
// when the user actually clicks Print / WhatsApp, not as part of the list query.
export const GET_PURCHASE_INVOICE_BALANCE = gql`
  query GetPurchaseInvoiceBalance($id: ID!, $adminid: ID) {
    getPurchaseInvoiceById(id: $id, adminid: $adminid) {
      id
      partyPreviousBalance
      partyCurrentBalance
    }
  }
`;

export const GET_PURCHASE_INVOICE_BY_ID = gql`
  query GetPurchaseInvoiceById($id: ID!, $adminid: ID) {
    getPurchaseInvoiceById(id: $id, adminid: $adminid) {
      id
      branchid
      adminid
      paymenttype
      partyacc {
        id
        accountname
        mobile
        address
        city
        state
        gstnumber
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
      productservice {
        productserviceid { id name }
        variantid { id name }
        purchaseunitid { id unitname }
        unitqty
        gst
        qty
        rate
        amount
        discount
        salesaccountid { id ledgername }
        purchaseaccountid { id ledgername }
        serviceaccountid { id ledgername }
      }
      othercharges {
        ledgerid { id ledgername }
        amount
        gstpercent
        gstamount
        totalamount
        remarks
      }
      deliverydate
      duedate
      transportname
      vehiclenumber
      ewaybillno
      distance
      roundoff
      invoicediscount
      invoicediscounttype
      isservice
      sourceorderid
      sourceorderno
      createdby_id
      createdby_name
      createdby_type
      status
      createdAt
      updatedAt
    }
  }
`;
