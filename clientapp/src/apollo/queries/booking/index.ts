import { gql } from '@apollo/client';

export const GET_BOOKING_ON = gql`
  query GetBookingOn($adminid: ID!) {
    getAdminSettings(adminid: $adminid) {
      id
      onlineBookingAllowed
      bookingOn
    }
  }
`;

export const GET_BOOKABLE_SERVICES = gql`
  query GetBookableServices($adminid: ID!) {
    getProductServices(filter: { adminid: $adminid, isservice: true }) {
      id
      name
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

export const GET_MY_APPOINTMENTS = gql`
  query GetMyAppointments {
    getMyAppointments {
      id
      billdate
      starttime
      duration
      apptStatus
      service
      staff
      amount
      notes
    }
  }
`;

export const CANCEL_MY_APPOINTMENT = gql`
  mutation CancelMyAppointment($id: ID!) {
    cancelMyAppointment(id: $id) {
      id
      apptStatus
    }
  }
`;
