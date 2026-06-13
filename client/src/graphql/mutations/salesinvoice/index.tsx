import { gql } from '@apollo/client';

export const ADD_SALES_INVOICE = gql`
  mutation AddSalesInvoice($input: SalesInvoiceInput!) {
  addSalesInvoice(input: $input) {
    id
    salesmenid {
      id
      name
    }
    paymenttype
    partyacc {
      id
      name
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
        accountname
      }
      purchaseaccountid {
        id
        accountname
      }
      serviceaccountid {
        id
        accountname
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

export const EDIT_SALES_INVOICE = gql`
  mutation EditSalesInvoice($id: ID!, $input: SalesInvoiceInput!) {
    editSalesInvoice(id: $id, input: $input) {
      id
      salesmenid {
        id
        name
      }
      paymenttype
      partyacc {
        id
        name
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
          accountname
        }
        purchaseaccountid {
          id
          accountname
        }
        serviceaccountid {
          id
          accountname
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

export const DELETE_SALES_INVOICE = gql`
  mutation DeleteSalesInvoice($id: ID!) {
    deleteSalesInvoice(id: $id)
  }
`;

export const RESET_SALES_INVOICE = gql`
  mutation ResetSalesInvoice($id: ID!) {
    resetSalesInvoice(id: $id)
  }
`;

export const MARK_SALES_INVOICE_DISPATCHED = gql`
  mutation MarkSalesInvoiceDispatched($id: ID!, $deliveryboyid: ID) {
    markSalesInvoiceDispatched(id: $id, deliveryboyid: $deliveryboyid) {
      id deliveryStatus
    }
  }
`;

export const MARK_SALES_INVOICE_DELIVERED = gql`
  mutation MarkSalesInvoiceDelivered($id: ID!, $byId: ID, $byName: String, $byType: String) {
    markSalesInvoiceDelivered(id: $id, byId: $byId, byName: $byName, byType: $byType) {
      id deliveryStatus deliveredAt
    }
  }
`;
