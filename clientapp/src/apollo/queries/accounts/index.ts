import { gql } from '@apollo/client';

export const GET_PRODUCTS = gql`
  query GetProducts($adminid: ID!, $limit: Int, $offset: Int) {
    getProductServices(filter: { adminid: $adminid }, limit: $limit, offset: $offset) {
      id
      name
      description
      imageurl
      status
      categoryid { id categoryname }
      productvariants {
        id
        name
        sku
        gst
        currentstock
        unitprices {
          mrp
          salesrate
          offerprice
          discount
          discounttype
          quantity
          unitid { id unitname }
        }
      }
    }
  }
`;

export const GET_SALES_ORDERS = gql`
  query GetSalesOrders($adminid: ID, $partyacc: ID, $salesmenid: ID) {
    getSalesOrders(filter: { adminid: $adminid, partyacc: $partyacc, salesmenid: $salesmenid }) {
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
        discount
        amount
        gst
      }
      createdAt
    }
  }
`;

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
      channel    { id channelName }
      region
      salesmanid { id name }
      ledgerid   { id ledgername }
    }
  }
`;

export const RESOLVE_PRICE = gql`
  query ResolvePrice(
    $productid: ID!
    $variantid: ID!
    $unitid: ID!
    $accountid: ID
    $channelid: ID
    $region: String
  ) {
    resolvePrice(
      productid: $productid
      variantid: $variantid
      unitid: $unitid
      accountid: $accountid
      channelid: $channelid
      region: $region
    ) {
      rate
      discount
      discounttype
    }
  }
`;

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
