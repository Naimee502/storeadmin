import { gql } from '@apollo/client';

/** Invoices the signed-in salesman / delivery boy can book a return against. */
export const GET_RETURNABLE_SALES_INVOICES = gql`
  query GetReturnableSalesInvoices($search: String) {
    getReturnableSalesInvoices(search: $search) {
      id
      billnumber
      billdate
      totalamount
      partyId
      partyName
      partyMobile
      deliveryStatus
      orderNumber
      returnableQty
    }
  }
`;

/** One invoice, ready to return against: header + qty still returnable per line. */
export const GET_SALES_RETURN_DRAFT = gql`
  query GetSalesReturnDraft($sourceInvoiceId: ID!) {
    getSalesReturnDraft(sourceInvoiceId: $sourceInvoiceId) {
      invoiceId
      billnumber
      billdate
      orderNumber
      adminid
      branchid
      partyId
      partyName
      partyMobile
      salesmenid
      paymenttype
      billtype
      taxorsupplytype
      invoicetype
      isservice
      lines {
        productserviceid
        productName
        variantid
        variantName
        salesunitid
        unitname
        unitqty
        gst
        rate
        discount
        invoicedQty
        returnedQty
        returnableQty
      }
    }
  }
`;

/** Returns this user booked (the server limits staff logins to their own). */
export const GET_MY_SALES_RETURNS = gql`
  query GetMySalesReturns($adminid: ID) {
    getSalesReturns(filter: { adminid: $adminid }) {
      id
      billnumber
      returndate
      totalamount
      reason
      refundMode
      sourceBillNumber
      sourceOrderNumber
      createdAt
      partyacc { id accountname mobile }
      productservice {
        productserviceid { id name }
        variantid { id name }
        qty
      }
    }
  }
`;

export const ADD_SALES_RETURN = gql`
  mutation AddSalesReturn($input: SalesReturnInput!) {
    addSalesReturn(input: $input) {
      id
      billnumber
      totalamount
    }
  }
`;
