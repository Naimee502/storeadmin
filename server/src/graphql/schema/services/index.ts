import { gql } from "apollo-server-express";

// Services master: the same ProductService records (isservice), with their own module and lean API.
export const servicesTypeDefs = gql`
  extend type Query {
    getServicesPage(filter: ProductServiceFilterInput, page: Int, pageSize: Int, search: String, columnFilters: [ColumnFilter!]): ProductServicePage!
    getServices(filter: ProductServiceFilterInput): [ProductService]!
    getServiceById(id: ID!): ProductService
  }

  extend type Mutation {
    addService(input: ProductServiceInput!): ProductService
    updateService(id: ID!, input: ProductServiceInput!, expectedUpdatedAt: String): ProductService
    deleteService(id: ID!, expectedUpdatedAt: String): Boolean
    resetService(id: ID!): Boolean
  }
`;
