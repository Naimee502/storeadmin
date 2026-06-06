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
    getSalesOrders(filter: { adminid: $adminid, partyacc: $partyacc, salesmenid: $salesmenid, includeConverted: true }) {
      id
      billnumber
      billdate
      totalamount
      subtotal
      totaldiscount
      totalgst
      cancelStatus
      isConverted
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

export const GET_SALES_ORDER_BY_ID = gql`
  query GetSalesOrderById($id: ID!) {
    getSalesOrderById(id: $id) {
      id
      billnumber
      billdate
      totalamount
      subtotal
      totaldiscount
      totalgst
      cancelStatus
      isConverted
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
      deliverydate
      duedate
      transportname
      vehiclenumber
      ewaybillno
      othercharges {
        ledgerid { id ledgername }
        amount
        gstpercent
        gstamount
        totalamount
        remarks
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
    $adminid: ID
    $accountid: ID
    $channelid: ID
    $region: String
  ) {
    resolvePrice(
      productid: $productid
      variantid: $variantid
      unitid: $unitid
      adminid: $adminid
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

export const GET_ACCOUNT_GROUPS = gql`
  query GetAccountGroups($adminId: ID) {
    getAccountGroups(adminId: $adminId) {
      id
      accountgroupname
      category
    }
  }
`;

export const GET_CHANNELS = gql`
  query GetChannels($adminId: ID) {
    getChannels(adminId: $adminId) {
      id
      channelName
      isDefault
      status
    }
  }
`;

export const GET_PAYMENTS = gql`
  query GetPayments($adminid: ID, $ledgerid: ID, $partyid: ID) {
    getPayments(filter: { adminid: $adminid, ledgerid: $ledgerid, partyid: $partyid }) {
      id
      paymentcode
      paymentdate
      type
      mode
      amount
      reference
      remarks
      status
      ledgerid { id ledgername }
      invoices { invoiceid invoicemodel settledamount }
      createdby_name
      createdAt
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

export const GET_ACCOUNT_LEDGERS = gql`
  query GetAccountLedgers($adminId: ID) {
    getAccountLedgers(adminId: $adminId) {
      id
      ledgername
      ledgertype
      status
    }
  }
`;
