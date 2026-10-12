import { gql } from "@apollo/client";

const PING_FIELDS = `
  id
  staffid { id name }
  role
  latitude
  longitude
  accuracy
  battery
  pingdate
  pingedAt
`;

export const GET_LOCATION_PINGS = gql`
  query GetLocationPings($filter: LocationPingFilterInput) {
    getLocationPings(filter: $filter) {
      ${PING_FIELDS}
    }
  }
`;

export const GET_LATEST_LOCATIONS = gql`
  query GetLatestLocations($filter: LocationPingFilterInput) {
    getLatestLocations(filter: $filter) {
      ${PING_FIELDS}
    }
  }
`;

// KM covered per staff per day (server filters GPS jitter / jumps).
export const GET_TRAVEL_SUMMARY = gql`
  query GetTravelSummary($filter: LocationPingFilterInput) {
    getTravelSummary(filter: $filter) {
      staffid
      staffname
      role
      pingdate
      km
      points
      firstAt
      lastAt
    }
  }
`;
