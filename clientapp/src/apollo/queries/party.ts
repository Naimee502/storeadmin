import { gql } from '@apollo/client/core';

// ── Products ─────────────────────────────────────────────────────────────────

export const GET_PRODUCTS = gql`
  query GetProducts($adminid: ID!, $limit: Int, $offset: Int) {
    getProductServices(filter: { adminid: $adminid }, limit: $limit, offset: $offset) {
      id
      name
      imageurl
      status
      categoryid { id name }
      variants {
        id
        name
        sku
        currentstock
        unitprices {
          mrp
          salesrate
          offerprice
          discount
          discounttype
        }
      }
    }
  }
`;

// ── Sales Orders ──────────────────────────────────────────────────────────────

export const GET_SALES_ORDERS = gql`
  query GetSalesOrders($adminid: ID!, $partyaccid: ID) {
    getSalesOrders(filter: { adminid: $adminid, partyaccid: $partyaccid }) {
      id
      billnumber
      billdate
      totalamount
      subtotal
      totaldiscount
      totalgst
      cancelStatus
      status
      partyacc   { id accountname mobile }
      salesmenid { id name }
      productservice {
        productserviceid { id name }
        variantid        { id name }
        qty
        rate
        amount
        gst
      }
      createdAt
    }
  }
`;

export const ADD_SALES_ORDER = gql`
  mutation AddSalesOrder($input: SalesOrderInput!) {
    addSalesOrder(input: $input) {
      id
      billnumber
      totalamount
      cancelStatus
    }
  }
`;

// ── Account / Party ───────────────────────────────────────────────────────────

export const GET_ACCOUNTS = gql`
  query GetAccounts($admin: ID!) {
    getAccounts(filter: { admin: $admin }) {
      id
      accountcode
      name
      mobile
      city
    }
  }
`;

export const GET_ACCOUNT = gql`
  query GetAccount($id: ID!, $adminId: ID!) {
    getAccountById(id: $id, adminId: $adminId) {
      id
      accountcode
      name
      mobile
      email
      address
      city
      state
      pincode
      gstnumber
      creditlimit
      openingbalance
      openingbalancetype
      channel  { id name }
      region
      salesmanid { id name }
      ledgerid   { id ledgername }
    }
  }
`;

// ── Ledger / Transactions ─────────────────────────────────────────────────────

export const GET_TRANSACTIONS = gql`
  query GetTransactions($adminid: ID!, $ledgerid: ID) {
    getTransactions(filter: { adminid: $adminid, ledgerid: $ledgerid }) {
      id
      transactioncode
      transactiondate
      narration
      totaldebit
      totalcredit
      source { docmodel docid }
      entries {
        ledgerid { id ledgername }
        debit
        credit
        remarks
      }
      createdAt
    }
  }
`;
