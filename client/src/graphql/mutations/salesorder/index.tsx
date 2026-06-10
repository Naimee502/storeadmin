import { gql } from '@apollo/client';

export const ADD_SALES_ORDER = gql`
  mutation AddSalesOrder($input: SalesOrderInput!) {
  addSalesOrder(input: $input) {
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
      productserviceid {
        id
        name
      }
      variantid {
        id
        name
      }
      salesunitid {
        id
        unitname
      }
      unitqty
      gst
      qty
      rate
      amount
      discount
      salesaccountid {
        id
        ledgername
      }
      purchaseaccountid {
        id
        ledgername
      }
      serviceaccountid {
        id
        ledgername
      }
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
    status
    createdAt
    updatedAt
  }
}
`;

export const EDIT_SALES_ORDER = gql`
  mutation EditSalesOrder($id: ID!, $input: SalesOrderInput!) {
    editSalesOrder(id: $id, input: $input) {
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
        productserviceid {
          id
          name
        }
        variantid {
          id
          name
        }
        salesunitid {
          id
          unitname
        }
        unitqty
        gst
        qty
        rate
        amount
        discount
        salesaccountid {
          id
          ledgername
        }
        purchaseaccountid {
          id
          ledgername
        }
        serviceaccountid {
          id
          ledgername
        }
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
      status
      createdAt
      updatedAt
    }
  }
`;

export const DELETE_SALES_ORDER = gql`
  mutation DeleteSalesOrder($id: ID!) {
    deleteSalesOrder(id: $id)
  }
`;

export const RESET_SALES_ORDER = gql`
  mutation ResetSalesOrder($id: ID!) {
    resetSalesOrder(id: $id)
  }
`;

export const CANCEL_SALES_ORDER = gql`
  mutation CancelSalesOrder($id: ID!, $reason: String) {
    cancelSalesOrder(id: $id, reason: $reason) {
      id
      cancelStatus
      cancelReason
      cancelledAt
    }
  }
`;

export const REOPEN_SALES_ORDER = gql`
  mutation ReopenSalesOrder($id: ID!) {
    reopenSalesOrder(id: $id) {
      id
      cancelStatus
    }
  }
`;

// ── Fulfilment transitions (admin can drive the lifecycle directly) ──
export const CONFIRM_SALES_ORDER = gql`
  mutation ConfirmSalesOrder($id: ID!) {
    confirmSalesOrder(id: $id) {
      id orderStatus isConverted
    }
  }
`;

export const MARK_SALES_ORDER_DISPATCHED = gql`
  mutation MarkSalesOrderDispatched($id: ID!, $deliveryboyid: ID) {
    markSalesOrderDispatched(id: $id, deliveryboyid: $deliveryboyid) {
      id orderStatus deliveryStatus
    }
  }
`;

export const MARK_SALES_ORDER_DELIVERED = gql`
  mutation MarkSalesOrderDelivered($id: ID!, $byId: ID, $byName: String, $byType: String) {
    markSalesOrderDelivered(id: $id, byId: $byId, byName: $byName, byType: $byType) {
      id orderStatus deliveryStatus deliveredAt
    }
  }
`;
