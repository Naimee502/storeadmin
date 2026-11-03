import { gql } from '@apollo/client';

// 🔹 Queries
export const GET_SALES_INVOICES = gql`
  query GetSalesInvoices($filter: SalesInvoiceFilterInput) {
    getSalesInvoices(filter: $filter) {
      id
      salesmenid {
        id
        name
      }
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
      received
      adminid
      branchid
      productservice {
        productserviceid { id name }
        variantid { id name }
        salesunitid { id unitname }
        salesaccountid { id ledgername }
        purchaseaccountid { id ledgername }
        serviceaccountid { id ledgername }
        unitqty
        gst
        qty
        rate
        amount
        discount
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
      createdby_id
      createdby_name
      createdby_type
      orderedby_name
      orderedby_type
      sourceorderid
      sourceorderno
      deliveryStatus
      deliveredAt
      deliveredByName
      deliveryboyid
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

// Listing-only query: just the columns the Sales Invoices table shows.
// Print / WhatsApp / Edit fetch the full bill by id when they need it, so the
// list no longer drags every line item, ledger and transport field of ~2000
// bills over the wire on every visit.
export const GET_SALES_INVOICES_LIST = gql`
  query GetSalesInvoicesList($filter: SalesInvoiceFilterInput) {
    getSalesInvoices(filter: $filter) {
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
      orderedby_name
      orderedby_type
      createdby_name
      createdby_type
      deliveryStatus
      cancelStatus
      status
      createdAt
    }
  }
`;

// Bill-settlement query for the Payment form: what a bill owes and how it is
// labelled — no line items. The form only ever needs these to list a party's
// open bills.
export const GET_SALES_INVOICES_SETTLE = gql`
  query GetSalesInvoicesSettle($filter: SalesInvoiceFilterInput) {
    getSalesInvoices(filter: $filter) {
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

export const GET_DELETED_SALES_INVOICES = gql`
  query GetDeletedSalesInvoices($filter: SalesInvoiceFilterInput) {
    getDeletedSalesInvoices(filter: $filter) {
      id
      salesmenid {
        id
        name
      }
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
      received
      adminid
      branchid
      productservice {
        productserviceid { id name }
        variantid { id name }
        salesunitid { id unitname }
        salesaccountid { id ledgername }
        purchaseaccountid { id ledgername }
        serviceaccountid { id ledgername }
        unitqty
        gst
        qty
        rate
        amount
        discount
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
      createdby_id
      createdby_name
      createdby_type
      orderedby_name
      orderedby_type
      sourceorderid
      sourceorderno
      deliveryStatus
      deliveredAt
      deliveredByName
      deliveryboyid
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

// Lightweight, print-only lookup — party's running balance is expensive to
// compute (sums every unsettled bill for the party), so it's fetched only
// when the user actually clicks Print, not as part of the list/table query.
export const GET_SALES_INVOICE_BALANCE = gql`
  query GetSalesInvoiceBalance($id: ID!, $adminid: ID) {
    getSalesInvoiceById(id: $id, adminid: $adminid) {
      id
      partyPreviousBalance
      partyCurrentBalance
    }
  }
`;

export const GET_SALES_INVOICE_BY_ID = gql`
  query getSalesInvoiceById($id: ID!, $adminid: ID) {
    getSalesInvoiceById(id: $id, adminid: $adminid) {
      id
      salesmenid {
        id
        name
      }
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
      received
      adminid
      branchid
      productservice {
        productserviceid { id name }
        variantid { id name }
        salesunitid { id unitname }
        salesaccountid { id ledgername }
        purchaseaccountid { id ledgername }
        serviceaccountid { id ledgername }
        unitqty
        gst
        qty
        rate
        amount
        discount
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
      createdby_id
      createdby_name
      createdby_type
      orderedby_name
      orderedby_type
      sourceorderid
      sourceorderno
      deliveryStatus
      deliveredAt
      deliveredByName
      deliveryboyid
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
