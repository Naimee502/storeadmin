import { gql } from "@apollo/client";
import { SERVICE_FIELDS } from "../../queries/services";

export const ADD_SERVICE = gql`mutation AddService($input: ProductServiceInput!) { addService(input: $input) { ${SERVICE_FIELDS} } }`;
export const UPDATE_SERVICE = gql`mutation UpdateService($id: ID!, $input: ProductServiceInput!, $expectedUpdatedAt: String) { updateService(id: $id, input: $input, expectedUpdatedAt: $expectedUpdatedAt) { ${SERVICE_FIELDS} } }`;
export const DELETE_SERVICE = gql`mutation DeleteService($id: ID!, $expectedUpdatedAt: String) { deleteService(id: $id, expectedUpdatedAt: $expectedUpdatedAt) }`;
export const RESET_SERVICE = gql`mutation ResetService($id: ID!) { resetService(id: $id) }`;
