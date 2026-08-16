import { gql } from "@apollo/client";

// Same OTP login the mobile app (clientapp) uses against the Account/Party
// model. If the mobile number has no matching Account yet, sendOTP throws
// "Mobile number not registered." — the login page catches that and drops
// into the registerAccount flow below instead of just showing an error.
export const SEND_OTP = gql`
  mutation SendOTP($adminId: ID!, $mobile: String!) {
    sendOTP(adminId: $adminId, mobile: $mobile) {
      success
      message
      otp
    }
  }
`;

export const VERIFY_OTP = gql`
  mutation VerifyOTP($adminId: ID!, $mobile: String!, $otp: String!) {
    verifyOTP(adminId: $adminId, mobile: $mobile, otp: $otp) {
      accessToken
      account {
        id
        name
        mobile
        email
        admin { id }
      }
    }
  }
`;

// Self-service signup for an unregistered mobile number — Name + Email only
// (Party Type/Sales Channel/etc. are all set automatically server-side).
// Returns the same shape as sendOTP so the login page can flow straight
// into OTP verification afterwards.
export const REGISTER_ACCOUNT = gql`
  mutation RegisterAccount($adminId: ID!, $name: String!, $mobile: String!, $email: String) {
    registerAccount(adminId: $adminId, name: $name, mobile: $mobile, email: $email) {
      success
      message
      otp
    }
  }
`;

// Account Details + Financial sections on the app's Profile screen.
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
      country
      pincode
      latitude
      longitude
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

// Self-service address update — AccountInput requires name + accountgroupid
// even for a partial edit (the resolver just $sets whatever's sent, but the
// schema itself demands both), so callers must always resend those two
// alongside whatever fields they're actually changing.
export const EDIT_ACCOUNT = gql`
  mutation EditAccount($id: ID!, $input: AccountInput!) {
    editAccount(id: $id, input: $input) {
      id
      address
      city
      state
      country
      pincode
      latitude
      longitude
    }
  }
`;

export const GET_SALES_ORDERS = gql`
  query GetSalesOrders($adminid: ID, $partyacc: ID, $includeDownline: Boolean) {
    getSalesOrders(
      filter: { adminid: $adminid, partyacc: $partyacc, includeConverted: true, includeDownline: $includeDownline }
    ) {
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

export const GET_PAYMENTS = gql`
  query GetPayments($adminid: ID, $partyid: ID) {
    getPayments(filter: { adminid: $adminid, partyid: $partyid }) {
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
      othercharges { ledgerid { id ledgername } amount gstpercent gstamount totalamount remarks }
      createdAt
    }
  }
`;

// Preview of the admin's auto-charges (delivery/handling/COD, etc.) so cart
// and checkout show the same freight/GST-on-charge lines the server will
// actually apply — see utils/chargerules.ts (ported from clientapp).
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

// deliveryMode (charge-preview's onlyWhenDeliveryBoy check) +
// partyManagesDownline (whether a channel party may see/manage its
// sub-parties' orders & payments) — getAdminSettings has no auth guard,
// same as getChargeRules.
export const GET_DELIVERY_MODE = gql`
  query GetDeliveryModeForCharges($adminid: ID!) {
    getAdminSettings(adminid: $adminid) {
      deliveryMode
      partyManagesDownline
    }
  }
`;

// Sub-party outstanding summary for a parent party's "Parties" tab — same
// query the app's Orders/Payments screens use to decide whether the
// downline UI should even be shown (business flag can be on with this
// party still having zero sub-parties assigned to it).
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

// Party-specific / channel / region price override for a product+variant+
// unit — ported from clientapp's Catalog/OrderEdit "Add to cart" flow.
// Customer-specific assignment wins, then channel+region, then channel,
// then region; base catalog price stands if none match.
export const RESOLVE_PRICE = gql`
  query ResolvePrice($productid: ID!, $variantid: ID!, $unitid: ID!, $adminid: ID, $accountid: ID, $channelid: ID, $region: String) {
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

export const ADD_PAYMENT = gql`
  mutation AddPayment($input: PaymentInput!) {
    addPayment(input: $input) {
      id
      paymentcode
      amount
      mode
      partyid  { id name }
      ledgerid { id ledgername }
    }
  }
`;

export const ADD_SALES_ORDER = gql`
  mutation AddSalesOrder($input: SalesOrderInput!) {
    addSalesOrder(input: $input) {
      id
      billnumber
      totalamount
      orderStatus
    }
  }
`;

export const EDIT_SALES_ORDER = gql`
  mutation EditSalesOrder($id: ID!, $input: SalesOrderInput!) {
    editSalesOrder(id: $id, input: $input) {
      id
      billnumber
      totalamount
      orderStatus
    }
  }
`;

// Order lifecycle actions a channel party can take on its downline's orders
// (never its own) once "Party manages downline" is on — mirrors clientapp's
// party OrderDetail screen exactly (mutation names/args match the server
// resolvers 1:1).
export const CONFIRM_SALES_ORDER = gql`
  mutation ConfirmSalesOrder($id: ID!) {
    confirmSalesOrder(id: $id) {
      id
      orderStatus
      isConverted
    }
  }
`;

export const CONVERT_SALES_ORDER_TO_INVOICE = gql`
  mutation ConvertSalesOrderToInvoice($id: ID!) {
    convertSalesOrderToInvoice(id: $id) {
      id
      billnumber
      totalamount
    }
  }
`;

export const MARK_SALES_ORDER_DISPATCHED = gql`
  mutation MarkSalesOrderDispatched($id: ID!, $deliveryboyid: ID) {
    markSalesOrderDispatched(id: $id, deliveryboyid: $deliveryboyid) {
      id
      deliveryStatus
    }
  }
`;

export const MARK_SALES_ORDER_DELIVERED = gql`
  mutation MarkSalesOrderDelivered($id: ID!, $byId: ID, $byName: String, $byType: String) {
    markSalesOrderDelivered(id: $id, byId: $byId, byName: $byName, byType: $byType) {
      id
      deliveryStatus
      deliveredAt
    }
  }
`;

// Whether the "Sales Invoice" module is enabled for this tenant — governs
// whether party managers see "Convert to Invoice" (module on) or the
// simpler "Mark Confirmed" (module off/absent). No auth guard, same as
// getAdminSettings.
export const GET_ADMIN_BY_ID = gql`
  query GetAdminByIdForModules($id: ID!) {
    getAdminById(id: $id) {
      id
      allowedmodules
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

// A party's open bills, computed on the SERVER so the figures survive a stale
// cache and cannot be raced by another collector.
export const GET_PARTY_OUTSTANDING_BILLS = gql`
  query GetPartyOutstandingBills(
    $partyid: ID!
    $invoicemodel: String!
    $adminid: ID!
    $branchid: ID
  ) {
    getPartyOutstandingBills(
      partyid: $partyid
      invoicemodel: $invoicemodel
      adminid: $adminid
      branchid: $branchid
    ) {
      id
      billnumber
      billdate
      totalamount
      outstanding
      invoicemodel
    }
  }
`;
