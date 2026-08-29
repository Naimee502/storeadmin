import { gql } from '@apollo/client';

export const GET_PRODUCTS = gql`
  query GetProducts($adminid: ID!, $limit: Int, $offset: Int) {
    getProductServices(filter: { adminid: $adminid }, limit: $limit, offset: $offset) {
      id
      name
      description
      imageurl
      imageurls
      status
      categoryid { id categoryname image }
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
  query GetSalesOrders($adminid: ID, $partyacc: ID, $salesmenid: ID, $includeDownline: Boolean) {
    getSalesOrders(filter: { adminid: $adminid, partyacc: $partyacc, salesmenid: $salesmenid, includeConverted: true, includeDownline: $includeDownline }) {
      id
      billnumber
      billdate
      totalamount
      subtotal
      totaldiscount
      totalgst
      cancelStatus
      isConverted
      invoicenumber
      outstanding
      orderStatus
      deliveryStatus
      deliveredAt
      status
      partyacc   { id accountname mobile channelName }
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
      invoicenumber
      outstanding
      orderStatus
      deliveryStatus
      deliveredAt
      status
      paymenttype
      billtype
      taxorsupplytype
      isservice
      createdby_type
      partyacc   { id accountname mobile channelName }
      salesmenid { id name }
      productservice {
        productserviceid { id name imageurl }
        variantid        { id name }
        salesunitid      { id unitname }
        unitqty
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

export const GET_SALES_INVOICE_BY_ID = gql`
  query GetSalesInvoiceById($id: ID!) {
    getSalesInvoiceById(id: $id) {
      id
      billnumber
      billdate
      totalamount
      subtotal
      totaldiscount
      totalgst
      deliveryStatus
      deliveredAt
      deliveredByName
      status
      partyacc   { id accountname mobile }
      salesmenid { id name }
      productservice {
        productserviceid { id name imageurl }
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
  query GetAccounts($admin: ID!, $salesmanid: ID) {
    getAccounts(filter: { admin: $admin, salesmanid: $salesmanid }) {
      id
      accountcode
      name
      mobile
      city
      address
      latitude
      longitude
      outstanding
      salesmanid { id name }
      ledgerid { id ledgername }
      accountgroupid { id }
      channel { id channelName }
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
      outstanding
      accountgroupid { id }
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
      handlesChannels { id channelName }
      status
    }
  }
`;

export const GET_PAYMENTS = gql`
  query GetPayments($adminid: ID, $ledgerid: ID, $partyid: ID, $includeDownline: Boolean) {
    getPayments(filter: { adminid: $adminid, ledgerid: $ledgerid, partyid: $partyid, includeDownline: $includeDownline }) {
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
      partyid  { id name }
      invoices { invoiceid invoicemodel settledamount }
      createdby_id
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
      partyid
      invoices { invoiceid invoicemodel settledamount }
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

// All transactions for an admin (used to compute outstanding allocations across
// the whole tenant — payments + transactions both settle invoices).
export const GET_ALL_TRANSACTIONS = gql`
  query GetAllTransactions($adminid: ID!) {
    getTransactions(filter: { adminid: $adminid }) {
      id
      partyid
      invoices { invoiceid invoicemodel settledamount }
    }
  }
`;

// Invoice fields needed for Tally-style bill allocation in the app.
const BILL_INVOICE_FIELDS = `
  id
  billnumber
  billdate
  paymenttype
  subtotal
  totalgst
  totalamount
  outstanding
  status
  partyacc { id }
  othercharges { ledgername totalamount }
`;

export const GET_PARTY_SALES_INVOICES = gql`
  query GetPartySalesInvoices($adminid: ID, $partyacc: ID) {
    getSalesInvoices(filter: { adminid: $adminid, partyacc: $partyacc }) {
      ${BILL_INVOICE_FIELDS}
    }
  }
`;

export const GET_PARTY_PURCHASE_INVOICES = gql`
  query GetPartyPurchaseInvoices($adminid: ID, $partyacc: ID) {
    getPurchaseInvoices(filter: { adminid: $adminid, partyacc: $partyacc }) {
      ${BILL_INVOICE_FIELDS}
    }
  }
`;

// Compute (without saving) the full accounting journal a document would post —
// reused for the party "Full Journal" manual entry.
export const PREVIEW_INVOICE_JOURNAL = gql`
  query PreviewInvoiceJournal($invoiceid: ID!, $invoicemodel: String!) {
    previewInvoiceJournal(invoiceid: $invoiceid, invoicemodel: $invoicemodel) {
      ledgerid
      ledgername
      debit
      credit
      remarks
    }
  }
`;

const DELIVERY_INVOICE_FIELDS = `
  id
  billnumber
  billdate
  totalamount
  outstanding
  paymenttype
  deliveryStatus
  deliveredAt
  partyacc { id accountname mobile address city latitude longitude }
`;

// Available pool — unassigned, undelivered invoices.
export const GET_DELIVERY_POOL = gql`
  query GetDeliveryPool($filter: SalesInvoiceFilterInput) {
    getSalesInvoices(filter: $filter) { ${DELIVERY_INVOICE_FIELDS} }
  }
`;

// Invoices assigned to the logged-in delivery boy.
export const GET_MY_DELIVERIES = gql`
  query GetMyDeliveries($filter: SalesInvoiceFilterInput) {
    getSalesInvoices(filter: $filter) { ${DELIVERY_INVOICE_FIELDS} }
  }
`;

// Back-compat alias (pool).
export const GET_DELIVERY_INVOICES = GET_DELIVERY_POOL;

export const GET_DELIVERY_ORDERS = gql`
  query GetDeliveryOrders($filter: SalesOrderFilterInput) {
    getSalesOrders(filter: $filter) {
      id
      billnumber
      billdate
      totalamount
      paymenttype
      cancelStatus
      isConverted
      invoicenumber
      outstanding
      orderStatus
      deliveryStatus
      deliveredAt
      partyacc {
        id accountname mobile address city latitude longitude
      }
      productservice { productserviceid { id } }
    }
  }
`;

export const GET_DOWNLINE_PARTY_BALANCES = gql`
  query GetDownlinePartyBalances($partyid: ID!) {
    getDownlinePartyBalances(partyid: $partyid) {
      id
      name
      mobile
      outstanding
    }
  }
`;

export const GET_ADMIN_SETTINGS = gql`
  query GetAdminSettings($adminid: ID!) {
    getAdminSettings(adminid: $adminid) {
      id
      deliveryMode
      partyManagesDownline
      enablePaymentDiscountCommission
      secureScreenApp
      displayProductPriceOnWebsite
      displayStockOnWebsite
      supportEmail
      supportPhone
      supportWhatsapp
      privacyPolicyUrl
      termsConditionsUrl
      heroBannerSlides {
        image
        title
        subtitle
        cta
        link
      }
      promoBanners {
        image
        title
        subtitle
        cta
        link
      }
    }
  }
`;

// Active charge rules (delivery/handling/COD, etc.) — used to preview the
// auto-charges an order will pick up BEFORE it's placed, so the cart total
// matches what the server will actually charge (see computeAutoCharges on
// addSalesOrder).
export const GET_CHARGE_RULES = gql`
  query GetChargeRules($adminid: ID!) {
    getChargeRules(adminid: $adminid) {
      id
      name
      chargeType
      value
      gstpercent
      minOrderValue
      freeAboveValue
      applyToCreatorTypes
      paymentTypes
      onlyWhenDeliveryBoy
      priority
      active
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

// Dry run before recording a collection: which bills does this amount clear,
// how much goes to the party's opening balance, and what stays On Account.
// Nothing is written — the collector approves the breakdown first, exactly
// like the admin panel's Confirm Auto Settlement dialog.
export const PREVIEW_ALLOCATION = gql`
  query PreviewAllocation(
    $partyid: ID!
    $invoicemodel: String!
    $adminid: ID!
    $branchid: ID
    $amount: Float!
    $priorityInvoiceId: ID
  ) {
    previewAllocation(
      partyid: $partyid
      invoicemodel: $invoicemodel
      adminid: $adminid
      branchid: $branchid
      amount: $amount
      priorityInvoiceId: $priorityInvoiceId
    ) {
      totaloutstanding
      allocated
      unallocated
      openingdue
      openingsettled
      lines {
        invoiceid
        invoicemodel
        billnumber
        billdate
        outstanding
        settledamount
        fullysettled
      }
    }
  }
`;
