import { gql } from "@apollo/client";

export const ADD_CHARGE_RULE = gql`
  mutation AddChargeRule($input: ChargeRuleInput!) {
    addChargeRule(input: $input) {
      id
      name
    }
  }
`;

export const EDIT_CHARGE_RULE = gql`
  mutation EditChargeRule($id: ID!, $input: ChargeRuleInput!) {
    editChargeRule(id: $id, input: $input) {
      id
      name
    }
  }
`;

export const DELETE_CHARGE_RULE = gql`
  mutation DeleteChargeRule($id: ID!) {
    deleteChargeRule(id: $id)
  }
`;

export const RESET_CHARGE_RULE = gql`
  mutation ResetChargeRule($id: ID!) {
    resetChargeRule(id: $id)
  }
`;
