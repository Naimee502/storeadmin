import { gql } from "@apollo/client";
import { QUOTATION_FIELDS } from "../../queries/quotation";

export const ADD_QUOTATION = gql`
  mutation AddQuotation($input: QuotationInput!) {
    addQuotation(input: $input) { ${QUOTATION_FIELDS} }
  }
`;
export const EDIT_QUOTATION = gql`
  mutation EditQuotation($id: ID!, $input: QuotationInput!, $expectedUpdatedAt: String) {
    editQuotation(id: $id, input: $input, expectedUpdatedAt: $expectedUpdatedAt) { ${QUOTATION_FIELDS} }
  }
`;
export const DELETE_QUOTATION = gql`
  mutation DeleteQuotation($id: ID!, $expectedUpdatedAt: String) {
    deleteQuotation(id: $id, expectedUpdatedAt: $expectedUpdatedAt)
  }
`;
export const RESET_QUOTATION = gql`
  mutation ResetQuotation($id: ID!) {
    resetQuotation(id: $id)
  }
`;
export const SET_QUOTATION_STATUS = gql`
  mutation SetQuotationStatus($id: ID!, $quotationStatus: String!, $statusreason: String, $convertedorderid: ID, $expectedUpdatedAt: String) {
    setQuotationStatus(id: $id, quotationStatus: $quotationStatus, statusreason: $statusreason, convertedorderid: $convertedorderid, expectedUpdatedAt: $expectedUpdatedAt) { ${QUOTATION_FIELDS} }
  }
`;
export const REVISE_QUOTATION = gql`
  mutation ReviseQuotation($id: ID!) {
    reviseQuotation(id: $id) { ${QUOTATION_FIELDS} }
  }
`;
