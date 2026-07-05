import { gql } from '@apollo/client';

// Batch-upload GPS pings collected while the field user was on the move.
export const ADD_LOCATION_PINGS = gql`
  mutation AddLocationPings($inputs: [LocationPingInput!]!) {
    addLocationPings(inputs: $inputs)
  }
`;

// Save the device's FCM token against the logged-in staff so the backend can
// push notifications to this specific salesman / delivery boy.
export const SAVE_DEVICE_TOKEN = gql`
  mutation SaveDeviceToken($id: ID!, $token: String!) {
    saveDeviceToken(id: $id, token: $token)
  }
`;
