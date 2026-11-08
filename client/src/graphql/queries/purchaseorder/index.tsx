import { gql } from '@apollo/client';

// Queries
export const GET_PURCHASE_ORDERS = gql`
  query GetPurchaseOrders($filter: PurchaseOrderFilterInput) {
    getPurchaseOrders(filter: $filter) {
      id
      purchasemenid {
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
        purchaseunitid { id unitname }
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

// Listing-only columns; Print/WhatsApp use GET_PURCHASE_ORDER_PRINT.
export const GET_PURCHASE_ORDERS_LIST = gql`
  query GetPurchaseOrdersList($filter: PurchaseOrderFilterInput) {
    getPurchaseOrders(filter: $filter) {
      id
      paymenttype
      partyacc {
        id
        accountname
        mobile
        city
      }
      billdate
      billnumber
      totalamount
      productservice {
        qty
      }
      createdby_name
      createdby_type
      isConverted
      orderStatus
      cancelStatus
      status
      createdAt
    }
  }
`;

export const GET_DELETED_PURCHASE_ORDERS = gql`
  query GetDeletedPurchaseOrders($filter: PurchaseOrderFilterInput) {
    getDeletedPurchaseOrders(filter: $filter) {
      id
      purchasemenid {
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
        purchaseunitid { id unitname }
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

// Full order for Print/WhatsApp, with party address/state/GSTIN.
export const GET_PURCHASE_ORDER_PRINT = gql`
  query getPurchaseOrderPrint($id: ID!) {
    getPurchaseOrderById(id: $id) {
      id
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
        purchaseunitid { id unitname }
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

export const GET_PURCHASE_ORDER_BY_ID = gql`
  query getPurchaseOrderById($id: ID!) {
    getPurchaseOrderById(id: $id) {
      id
      purchasemenid {
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
        purchaseunitid { id unitname }
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

// One page of the Purchase Orders list (same columns as GET_PURCHASE_ORDERS_LIST).
export const GET_PURCHASE_ORDERS_PAGE = gql`
  query GetPurchaseOrdersPage(
    $filter: PurchaseOrderFilterInput
    $page: Int
    $pageSize: Int
    $search: String
    $columnFilters: [ColumnFilter!]
  ) {
    getPurchaseOrdersPage(filter: $filter, page: $page, pageSize: $pageSize, search: $search, columnFilters: $columnFilters) {
      total
      items {
        id
        paymenttype
        partyacc {
          id
          accountname
          mobile
          city
        }
        billdate
        billnumber
        totalamount
        productservice {
          qty
        }
        createdby_name
        createdby_type
        isConverted
        orderStatus
        cancelStatus
        status
        createdAt
      }
    }
  }
`;
