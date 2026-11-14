import { gql } from "apollo-server-express";

export const bookingTypeDefs = gql`
  type BookingSlot {
    "HH:MM, 24 hour"
    starttime: String!
    "Staff free at this time (0 when the service has no staff set)."
    available: Int!
  }

  "A customer's own booking."
  type MyAppointment {
    id: ID!
    billdate: String!
    starttime: String!
    duration: Int
    "booked, confirmed, arrived, done, noshow, cancelled"
    apptStatus: String!
    service: String
    staff: String
    amount: Float
    notes: String
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
    "The signed-in customer's bookings, newest first."
    getMyAppointments: [MyAppointment!]!
  }

  extend type Mutation {
    "A signed-in customer books a free slot; it lands in Appointments as Booked."
    bookAppointment(input: BookAppointmentInput!): Appointment!
    "Customer cancels their own upcoming Booked or Confirmed booking."
    cancelMyAppointment(id: ID!): MyAppointment!
  }
`;
