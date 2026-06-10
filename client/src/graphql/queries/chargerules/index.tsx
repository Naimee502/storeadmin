import { gql } from "@apollo/client";

const CHARGE_RULE_FIELDS = `
  id
  adminid
  name
  ledgerid { id ledgername }
  chargeType
  value
  gstpercent
  minOrderValue
  freeAboveValue
  applyToCreatorTypes
  paymentTypes
  onlyWhenDeliveryBoy
  priority
  active
  status
`;

export const GET_CHARGE_RULES = gql`
  query GetChargeRules($adminid: ID!) {
    getChargeRules(adminid: $adminid) {
      ${CHARGE_RULE_FIELDS}
    }
  }
`;

export const GET_DELETED_CHARGE_RULES = gql`
  query GetDeletedChargeRules($adminid: ID!) {
    getDeletedChargeRules(adminid: $adminid) {
      ${CHARGE_RULE_FIELDS}
    }
  }
`;

export const GET_CHARGE_RULE_BY_ID = gql`
  query GetChargeRuleById($id: ID!) {
    getChargeRuleById(id: $id) {
      ${CHARGE_RULE_FIELDS}
    }
  }
`;
