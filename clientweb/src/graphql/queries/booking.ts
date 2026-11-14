import { gql } from "@apollo/client";

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
      description
      imageurl
      imageurls
      categoryid { id categoryname }
      servicevariants {
        id
        name
        servicerate
        requiresappointment
        duration { amount unit }
        pricingunit
        taxinclusive
        visitcharge
        warrantydays
        locationType
        remarks
        checklist
      }
    }
  }
`;

export const GET_BOOKING_SLOTS = gql`
  query GetBookingSlots($adminid: ID!, $serviceid: ID!, $variantid: ID, $date: String!, $doctorid: ID) {
    getBookingSlots(adminid: $adminid, serviceid: $serviceid, variantid: $variantid, date: $date, doctorid: $doctorid) {
      starttime
      available
    }
  }
`;

export const GET_CLINIC_DOCTORS = gql`
  query GetClinicDoctors($adminid: ID!, $serviceid: ID) {
    getClinicDoctors(adminid: $adminid, serviceid: $serviceid) {
      id name photo specialization qualification experience fee about
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
