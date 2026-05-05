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
