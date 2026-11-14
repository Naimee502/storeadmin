import { gql } from "@apollo/client";

export const GET_BOOKING_ON = gql`
  query GetBookingOn($adminid: ID!) {
    getAdminSettings(adminid: $adminid) {
      id
      bookingOn
    }
  }
`;

export const GET_BOOKABLE_SERVICES = gql`
  query GetBookableServices($adminid: ID!) {
    getProductServices(filter: { adminid: $adminid, isservice: true }) {
      id
      name
      description
      imageurl
      servicevariants {
        id
        name
        servicerate
        requiresappointment
        duration { amount unit }
      }
    }
  }
`;

export const GET_BOOKING_SLOTS = gql`
  query GetBookingSlots($adminid: ID!, $serviceid: ID!, $variantid: ID, $date: String!) {
    getBookingSlots(adminid: $adminid, serviceid: $serviceid, variantid: $variantid, date: $date) {
      starttime
      available
    }
  }
`;

export const BOOK_APPOINTMENT = gql`
  mutation BookAppointment($input: BookAppointmentInput!) {
    bookAppointment(input: $input) {
      id
      billdate
      starttime
    }
  }
`;
