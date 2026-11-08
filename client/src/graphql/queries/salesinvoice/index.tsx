import { gql } from '@apollo/client';

// Queries
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

// Listing-only columns; Print/WhatsApp/Edit load the full bill by id.
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

// Bill amounts and labels for the Payment form; no line items.
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

// Party running balance, fetched only on Print (expensive).
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

export const GET_SALES_INVOICES_PAGE = gql`
  query GetSalesInvoicesPage(
    $filter: SalesInvoiceFilterInput
    $page: Int
    $pageSize: Int
    $search: String
    $columnFilters: [ColumnFilter!]
  ) {
    getSalesInvoicesPage(filter: $filter, page: $page, pageSize: $pageSize, search: $search, columnFilters: $columnFilters) {
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
  }
`;
