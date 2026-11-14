import { gql } from "apollo-server-express";

export const clinicTypeDefs = gql`
  type DoctorProfile {
    specialization: String
    qualification: String
    regno: String
    experience: Float
    fee: Float
    about: String
    "false hides the doctor from online booking"
    online: Boolean
  }
  input DoctorProfileInput {
    specialization: String
    qualification: String
    regno: String
    experience: Float
    fee: Float
    about: String
    online: Boolean
  }

  "The owner's own doctor profile (a doctor running the clinic alone)."
  type OwnerDoctor {
    name: String
    specialization: String
    qualification: String
    regno: String
    experience: Float
    fee: Float
    about: String
    photo: String
    online: Boolean
  }
  input OwnerDoctorInput {
    name: String
    specialization: String
    qualification: String
    regno: String
    experience: Float
    fee: Float
    about: String
    photo: String
    online: Boolean
  }

  extend type StaffAccount { doctor: DoctorProfile }
  extend input StaffAccountInput { doctor: DoctorProfileInput }
  extend type AdminSettings { ownerDoctor: OwnerDoctor }
  extend input AdminSettingsInput { ownerDoctor: OwnerDoctorInput }

  "A doctor patients can book (website and app)."
  type ClinicDoctor {
    "Staff id, or owner when the business owner is the doctor."
    id: ID!
    name: String!
    photo: String
    specialization: String
    qualification: String
    experience: Float
    fee: Float
    about: String
  }

  type RxMedicine {
    productserviceid: SimpleRef
    name: String!
    dose: String
    frequency: String
    "before, after, empty, bedtime"
    timing: String
    days: Float
    qty: Float
    notes: String
  }
  input RxMedicineInput {
    productserviceid: ID
    name: String!
    dose: String
    frequency: String
    timing: String
    days: Float
    qty: Float
    notes: String
  }
  type RxVitals { bp: String pulse: String temperature: String weight: String spo2: String sugar: String }
  input RxVitalsInput { bp: String pulse: String temperature: String weight: String spo2: String sugar: String }

  type Prescription {
    id: ID
    branchid: ID
    partyacc: ServiceParty
    customername: String
    customermobile: String
    appointmentid: ID
    "Doctor (staff); empty when the owner is the doctor."
    staffid: SimpleRef
    doctorname: String
    doctorqualification: String
    doctorregno: String
    rxnumber: String
    billdate: String!
    complaints: String
    diagnosis: String
    vitals: RxVitals
    medicines: [RxMedicine!]
    tests: String
    advice: String
    nextvisit: String
    invoiceid: ID
    createdby_name: String
    status: Boolean
    createdAt: String
    updatedAt: String
  }
  input PrescriptionInput {
    clientRequestId: String
    branchid: ID
    partyacc: ID
    customername: String
    customermobile: String
    appointmentid: ID
    "Doctor (staff); leave empty when the owner is the doctor."
    staffid: ID
    billdate: String!
    complaints: String
    diagnosis: String
    vitals: RxVitalsInput
    medicines: [RxMedicineInput!]
    tests: String
    advice: String
    nextvisit: String
  }
  type PrescriptionPage { items: [Prescription!]! total: Int! }

  "A patient's own prescription."
  type MyPrescription {
    id: ID!
    rxnumber: String
    billdate: String!
    doctorname: String
    doctorqualification: String
    complaints: String
    diagnosis: String
    vitals: RxVitals
    medicines: [RxMedicine!]!
    tests: String
    advice: String
    nextvisit: String
  }

  extend type Query {
    "Doctors open for online booking (Prescriptions module on)."
    getClinicDoctors(adminid: ID!, serviceid: ID): [ClinicDoctor!]!
    getPrescriptionsPage(filter: ServiceFilterInput, page: Int, pageSize: Int, search: String, columnFilters: [ColumnFilter!]): PrescriptionPage!
    getPrescriptions(filter: ServiceFilterInput): [Prescription!]!
    getDeletedPrescriptions(filter: ServiceFilterInput): [Prescription!]!
    getPrescriptionById(id: ID!): Prescription
    getMyPrescriptions: [MyPrescription!]!
    getMyPrescription(id: ID!): MyPrescription!
  }

  extend type Mutation {
    addPrescription(input: PrescriptionInput!): Prescription
    editPrescription(id: ID!, input: PrescriptionInput!, expectedUpdatedAt: String): Prescription
    deletePrescription(id: ID!, expectedUpdatedAt: String): Boolean
    resetPrescription(id: ID!): Boolean
    "A 15-minute link to print the patient's own prescription."
    myPrescriptionPrintLink(id: ID!): String!
  }
`;
