import { gql } from '@apollo/client';

// 🔹 Queries
// Bill-settlement query for the Payment form — no line items.
export const GET_PURCHASE_INVOICES_SETTLE = gql`
  query GetPurchaseInvoicesSettle($filter: PurchaseInvoiceFilterInput) {
    getPurchaseInvoices(filter: $filter) {
      id
      paymenttype
      partyacc {
        id
        accountname
      }
      billdate
      billnumber
      duedate
      subtotal
      totalgst
      totalamount
      othercharges {
        ledgerid { id ledgername }
        amount
        gstpercent
        gstamount
        totalamount
        remarks
      }
      sourceorderno
      cancelStatus
      status
      createdAt
    }
  }
`;

// Listing-only query: just the columns the Purchase Invoices table shows.
// Print / WhatsApp fetch the full bill by id when they need it, so the list
// no longer drags every line item, ledger and transport field over the wire.
export const GET_PURCHASE_INVOICES_LIST = gql`
  query GetPurchaseInvoicesList($filter: PurchaseInvoiceFilterInput) {
    getPurchaseInvoices(filter: $filter) {
      id
      paymenttype
      partyacc {
        id
        accountname
        mobile
        city
        state
        gstnumber
      }
      billdate
      billnumber
      totalamount
      productservice {
        qty
      }
      createdby_name
      createdby_type
      cancelStatus
      status
      createdAt
    }
  }
`;

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
      paid
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
      cancelStatus
      cancelReason
      cancelledAt
      cancelledByName
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
      paid
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
      cancelStatus
      cancelReason
      cancelledAt
      cancelledByName
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
      paid
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
      cancelStatus
      cancelReason
      cancelledAt
      cancelledByName
      status
      createdAt
      updatedAt
    }
  }
`;

// One page of the Purchase Invoices list (same columns as GET_PURCHASE_INVOICES_LIST).
export const GET_PURCHASE_INVOICES_PAGE = gql`
  query GetPurchaseInvoicesPage(
    $filter: PurchaseInvoiceFilterInput
    $page: Int
    $pageSize: Int
    $search: String
    $columnFilters: [ColumnFilter!]
  ) {
    getPurchaseInvoicesPage(filter: $filter, page: $page, pageSize: $pageSize, search: $search, columnFilters: $columnFilters) {
      total
      items {
        id
        paymenttype
        partyacc {
          id
          accountname
          mobile
          city
          state
          gstnumber
        }
        billdate
        billnumber
        totalamount
        productservice {
          qty
        }
        createdby_name
        createdby_type
        cancelStatus
        status
        createdAt
      }
    }
  }
`;
