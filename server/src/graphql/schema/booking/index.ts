import { gql } from "apollo-server-express";

export const bookingTypeDefs = gql`
  type BookingSlot {
    "HH:MM, 24 hour"
    starttime: String!
    "Staff free at this time (0 when the service has no staff set)."
    available: Int!
  }

  input BookAppointmentInput {
    serviceid: ID!
    variantid: ID
    "YYYY-MM-DD"
    date: String!
    starttime: String!
    notes: String
  }

  extend type Query {
    "Free start times for a service on a day (website and app booking)."
    getBookingSlots(adminid: ID!, serviceid: ID!, variantid: ID, date: String!): [BookingSlot!]!
  }

  extend type Mutation {
    "A signed-in customer books a free slot; it lands in Appointments as Booked."
    bookAppointment(input: BookAppointmentInput!): Appointment!
  }
`;
