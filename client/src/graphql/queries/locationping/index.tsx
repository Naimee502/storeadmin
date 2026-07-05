import { gql } from "@apollo/client";

const PING_FIELDS = `
  id
  staffid { id name }
  role
  latitude
  longitude
  accuracy
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
