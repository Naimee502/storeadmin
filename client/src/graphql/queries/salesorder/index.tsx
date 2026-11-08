import { gql } from '@apollo/client';

// Queries
export const GET_SALES_ORDERS = gql`
  query GetSalesOrders($filter: SalesOrderFilterInput) {
    getSalesOrders(filter: $filter) {
      id
      salesmenid {
        id
        name
      }
      routeid
      ordersource
      deliveryboyid
      deliveryStatus
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
      invoicenumber
      notes
      ordertype
      subtotal
      totaldiscount
      totalgst
      totalamount
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
      isConverted
      orderStatus
      cancelStatus
      status
      createdAt
      updatedAt
    }
}
`;

// Listing-only query: just the columns the Sales Orders table (and its status
// dropdown / WhatsApp message) reads. Print / WhatsApp PDF fetch the full order
// by id (GET_SALES_ORDER_PRINT), so the list no longer drags every line item,
// ledger and transport field — nor the per-row invoicenumber lookup — over the
// wire on every visit.
export const GET_SALES_ORDERS_LIST = gql`
  query GetSalesOrdersList($filter: SalesOrderFilterInput) {
    getSalesOrders(filter: $filter) {
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
      deliveryStatus
      isConverted
      orderStatus
      cancelStatus
      status
      createdAt
    }
  }
`;

// Full order for Print / WhatsApp from the Sales Orders list. Same fields as
// GET_SALES_ORDERS (GET_SALES_ORDER_BY_ID lacks the party's state / GSTIN /
// address the printable needs), fetched for ONE order at click time.
export const GET_SALES_ORDER_PRINT = gql`
  query GetSalesOrderPrint($id: ID!) {
    getSalesOrderById(id: $id) {
      id
      salesmenid {
        id
        name
      }
      routeid
      ordersource
      deliveryboyid
      deliveryStatus
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
      ordertype
      subtotal
      totaldiscount
      totalgst
      totalamount
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
      isConverted
      orderStatus
      cancelStatus
      status
      createdAt
      updatedAt
    }
}
`;

export const GET_DELETED_SALES_ORDERS = gql`
  query GetDeletedSalesOrders($filter: SalesOrderFilterInput) {
    getDeletedSalesOrders(filter: $filter) {
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
        city
      }
      taxorsupplytype
      billdate
      billtype
      billnumber
      invoicenumber
      notes
      ordertype
      subtotal
      totaldiscount
      totalgst
      totalamount
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
      isConverted
      orderStatus
      cancelStatus
      status
      createdAt
      updatedAt
    }
  }
`;

export const GET_SALES_ORDER_BY_ID = gql`
  query getSalesOrderById($id: ID!) {
    getSalesOrderById(id: $id) {
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
        city
      }
      taxorsupplytype
      billdate
      billtype
      billnumber
      invoicenumber
      notes
      ordertype
      subtotal
      totaldiscount
      totalgst
      totalamount
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
      isConverted
      orderStatus
      cancelStatus
      status
      createdAt
      updatedAt
    }
  }
`;

// Server-paged Sales Orders list: same fields as GET_SALES_ORDERS_LIST.
export const GET_SALES_ORDERS_PAGE = gql`
  query GetSalesOrdersPage(
    $filter: SalesOrderFilterInput
    $page: Int
    $pageSize: Int
    $search: String
    $columnFilters: [ColumnFilter!]
  ) {
    getSalesOrdersPage(filter: $filter, page: $page, pageSize: $pageSize, search: $search, columnFilters: $columnFilters) {
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
        deliveryStatus
        isConverted
        orderStatus
        cancelStatus
        status
        createdAt
      }
    }
  }
`;
