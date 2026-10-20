import { gql } from "apollo-server-express";

export const geocodeTypeDefs = gql`
  # Postal address worked out from a GPS point — used to pre-fill a new
  # party's Address / City / State / Pin Code from the captured shop location.
  type GeoAddress {
    address: String
    city: String
    state: String
    pincode: String
    country: String
  }

  extend type Query {
    reverseGeocode(latitude: Float!, longitude: Float!): GeoAddress
  }
`;
