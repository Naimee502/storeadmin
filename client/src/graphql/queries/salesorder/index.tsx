import { gql } from '@apollo/client';

// 🔹 Queries
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
