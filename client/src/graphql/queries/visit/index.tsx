import { gql } from "@apollo/client";

const VISIT_FIELDS = `
  id
  adminid
  branchid
  salesmanid { id name }
  partyacc { id name mobile }
  routeid { id routename }
  visitdate
  day
  visited
  reason
  notes
  ordercreated
  orderid
  latitude
  longitude
  visitedAt
  status
  createdAt
`;

export const GET_VISITS = gql`
  query GetVisits($filter: VisitFilterInput) {
    getVisits(filter: $filter) {
      ${VISIT_FIELDS}
    }
  }
`;
