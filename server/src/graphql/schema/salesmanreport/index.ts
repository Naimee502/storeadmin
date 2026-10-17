import { gql } from "apollo-server-express";

// ─────────────────────────────────────────────────────────────────────────────
// Salesman field analytics (admin panel reports + salesman app dashboard).
// Everything is computed on the server from routes, visits, orders, payments
// and GPS pings — see utils/fieldreport for the rules (productive /
// unproductive / missed calls, target, geo-fence).
// ─────────────────────────────────────────────────────────────────────────────
export const salesmanReportTypeDefs = gql`
  input SalesmanReportFilter {
    adminid: ID!
    branchid: ID
    salesmanid: ID
    dateFrom: String!
    dateTo: String!
  }

  type SalesmanDaily {
    date: String!
    planned: Int!
    productive: Int!
    unproductive: Int!
    missed: Int!
    pending: Int!
    orders: Int!
    amount: Float!
    collections: Float!
  }

  type SalesmanPerformance {
    salesmanid: ID!
    salesmanname: String!
    mobile: String
    plannedCalls: Int!
    productiveCalls: Int!
    unproductiveCalls: Int!
    missedCalls: Int!
    pendingCalls: Int!
    offRouteCalls: Int!
    totalCalls: Int!
    productivityPct: Float!
    coveragePct: Float!
    orders: Int!
    ordersOnRoute: Int!
    ordersOffRoute: Int!
    orderAmount: Float!
    avgOrderValue: Float!
    totalQty: Float!
    linesSold: Int!
    collections: Float!
    km: Float!
    workingDays: Int!
    targetMonth: String!
    monthTarget: Float!
    monthAchieved: Float!
    monthAchievedPct: Float!
    monthRemaining: Float!
    daily: [SalesmanDaily!]!
  }

  type SalesmanCallLogRow {
    date: String!
    day: String
    salesmanid: ID!
    salesmanname: String!
    routeid: ID
    routename: String
    partyid: ID!
    partyname: String!
    partymobile: String
    status: String!
    onRoute: Boolean!
    reason: String
    notes: String
    visitTime: String
    orderNo: String
    orderAmount: Float
    distanceM: Float
  }

  type SalesmanProductSalesRow {
    salesmanid: ID!
    salesmanname: String!
    productid: ID!
    productname: String!
    categoryid: ID
    categoryname: String
    qty: Float!
    amount: Float!
    orders: Int!
  }

  type GeoFenceCheck {
    enabled: Boolean!
    allowed: Boolean!
    radiusM: Int!
    distanceM: Float
    partyHasLocation: Boolean!
    message: String
  }

  type SalesmanDashboard {
    today: SalesmanPerformance!
    month: SalesmanPerformance!
    last7: [SalesmanDaily!]!
  }

  type SalesmanLeaderboardRow {
    rank: Int!
    salesmanid: ID!
    salesmanname: String!
    isMe: Boolean!
    monthTarget: Float!
    monthAchieved: Float!
    monthAchievedPct: Float!
    orders: Int!
    productiveCalls: Int!
    totalCalls: Int!
    productivityPct: Float!
    collections: Float!
  }

  type SalesmanLeaderboard {
    enabled: Boolean!
    month: String!
    rows: [SalesmanLeaderboardRow!]!
  }

  input MarkVisitInput {
    adminid: ID!
    branchid: ID
    salesmanid: ID!
    partyacc: ID!
    routeid: ID
    day: String
    outcome: String!
    reason: String
    notes: String
    orderid: ID
    latitude: Float
    longitude: Float
  }

  extend type Query {
    getSalesmanPerformance(filter: SalesmanReportFilter!): [SalesmanPerformance!]!
    getSalesmanCallLog(filter: SalesmanReportFilter!): [SalesmanCallLogRow!]!
    getSalesmanProductSales(filter: SalesmanReportFilter!): [SalesmanProductSalesRow!]!
    getSalesmanDashboard(adminid: ID!, salesmanid: ID!, date: String): SalesmanDashboard!
    # Team ranking for a month (YYYY-MM): achievement % of target, then order value.
    getSalesmanLeaderboard(adminid: ID!, month: String, salesmanid: ID): SalesmanLeaderboard!
    checkGeoFence(adminid: ID!, partyacc: ID!, latitude: Float, longitude: Float): GeoFenceCheck!
  }

  extend type Mutation {
    markVisit(input: MarkVisitInput!): Visit!
  }
`;
