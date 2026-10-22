import { gql } from '@apollo/client';

const PERF = `
  plannedCalls productiveCalls unproductiveCalls missedCalls pendingCalls offRouteCalls totalCalls
  productivityPct coveragePct orders orderAmount avgOrderValue collections km
  targetMonth monthTarget monthAchieved monthAchievedPct monthRemaining
`;

// Salesman home: today, this month (target) and the last 7 days — computed on
// the server with the same rules as the admin Salesman Field Report.
export const GET_SALESMAN_DASHBOARD = gql`
  query GetSalesmanDashboard($adminid: ID!, $salesmanid: ID!, $date: String) {
    getSalesmanDashboard(adminid: $adminid, salesmanid: $salesmanid, date: $date) {
      today { ${PERF} }
      month { ${PERF} }
      last7 { date planned productive unproductive missed pending orders amount collections }
    }
  }
`;

// Is the salesman (lat/lng) inside the business's geo-fence for this party?
export const CHECK_GEO_FENCE = gql`
  query CheckGeoFence($adminid: ID!, $partyacc: ID!, $latitude: Float, $longitude: Float, $accuracy: Float) {
    checkGeoFence(adminid: $adminid, partyacc: $partyacc, latitude: $latitude, longitude: $longitude, accuracy: $accuracy) {
      enabled allowed radiusM distanceM partyHasLocation message
    }
  }
`;

// Team ranking for a month — target achievement % (then order value).
export const GET_SALESMAN_LEADERBOARD = gql`
  query GetSalesmanLeaderboard($adminid: ID!, $month: String, $salesmanid: ID) {
    getSalesmanLeaderboard(adminid: $adminid, month: $month, salesmanid: $salesmanid) {
      enabled
      month
      rows {
        rank salesmanid salesmanname isMe
        monthTarget monthAchieved monthAchievedPct
        orders productiveCalls totalCalls productivityPct collections
      }
    }
  }
`;
