import { gql } from '@apollo/client';

export const ADD_SALES_INVOICE = gql`
  mutation AddSalesInvoice($input: SalesInvoiceInput!) {
    addSalesInvoice(input: $input) {
      id
      branchid
      salesmenid
      paymenttype
      partyacc
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
      products {
        productid
        gst
        qty
        rate
        amount
        discount
      }
      status
      admin {
        id
        name
        email
      }
    }
  }
`;

export const EDIT_SALES_INVOICE = gql`
  mutation EditSalesInvoice($id: ID!, $input: SalesInvoiceInput!) {
    editSalesInvoice(id: $id, input: $input) {
      id
      branchid
      salesmenid
      paymenttype
      partyacc
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
      products {
        productid
        gst
        qty
        rate
        amount
        discount
      }
      status
      admin {
        id
        name
        email
      }
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
