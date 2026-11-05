import { gql } from "@apollo/client";

// Delivery boy report (pages/reports/deliveryboy) — only the fields that page
// reads. Same root fields/filters as GET_SALES_ORDERS / GET_PAYMENTS.

// billdate is a "YYYY-MM-DD" string compared as a string on the server, so
// billdateFrom/billdateTo include the whole To day.
export const DELIVERYBOY_REPORT_SALES_ORDERS = gql`
  query DeliveryBoyReportSalesOrders($filter: SalesOrderFilterInput) {
    getSalesOrders(filter: $filter) {
      id
      billdate
      deliveryboyid
      deliveryStatus
      totalamount
    }
  }
`;

export const DELIVERYBOY_REPORT_PAYMENTS = gql`
  query DeliveryBoyReportPayments($filter: PaymentFilterInput) {
    getPayments(filter: $filter) {
      id
      type
      paymentdate
      amount
      createdby_id
    }
  }
`;
