import { gql } from "@apollo/client";

const DAILY = `date planned productive unproductive missed pending orders amount collections`;

export const GET_SALESMAN_PERFORMANCE = gql`
  query GetSalesmanPerformance($filter: SalesmanReportFilter!) {
    getSalesmanPerformance(filter: $filter) {
      salesmanid salesmanname mobile
      routes
      plannedCalls productiveCalls unproductiveCalls missedCalls pendingCalls offRouteCalls totalCalls
      productivityPct coveragePct
      orders ordersOnRoute ordersOffRoute orderAmount avgOrderValue totalQty linesSold
      collections km workingDays
      targetMonth monthTarget monthAchieved monthAchievedPct monthRemaining
      daily { ${DAILY} }
    }
  }
`;

export const GET_SALESMAN_CALL_LOG = gql`
  query GetSalesmanCallLog($filter: SalesmanReportFilter!) {
    getSalesmanCallLog(filter: $filter) {
      date day salesmanid salesmanname routeid routename partyid partyname partymobile
      status onRoute reason notes visitTime orderNo orderAmount distanceM
    }
  }
`;

export const GET_SALESMAN_PRODUCT_SALES = gql`
  query GetSalesmanProductSales($filter: SalesmanReportFilter!) {
    getSalesmanProductSales(filter: $filter) {
      salesmanid salesmanname productid productname categoryid categoryname qty amount orders
    }
  }
`;

export const GET_SALESMAN_ORDER_LINES = gql`
  query GetSalesmanOrderLines($filter: SalesmanReportFilter!) {
    getSalesmanOrderLines(filter: $filter) {
      orderid billnumber date salesmanid salesmanname routename partyid partyname partycity partymobile
      productid productname categoryid categoryname variantname unitname baseunitname
      unitqty qty baseqty rate discount gst amount
    }
  }
`;
