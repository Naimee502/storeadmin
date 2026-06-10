import { useMutation, useQuery } from "@apollo/client";
import { GET_CHARGE_RULES, GET_DELETED_CHARGE_RULES, GET_CHARGE_RULE_BY_ID } from "../../queries/chargerules";
import { ADD_CHARGE_RULE, EDIT_CHARGE_RULE, DELETE_CHARGE_RULE, RESET_CHARGE_RULE } from "../../mutations/chargerules";

export const useChargeRulesQuery = (adminid?: string) =>
  useQuery(GET_CHARGE_RULES, { variables: { adminid }, skip: !adminid });

export const useDeletedChargeRulesQuery = (adminid?: string) =>
  useQuery(GET_DELETED_CHARGE_RULES, { variables: { adminid }, skip: !adminid });

export const useChargeRuleByIdQuery = (id: string) =>
  useQuery(GET_CHARGE_RULE_BY_ID, { variables: { id }, skip: !id });

export const useChargeRuleMutations = () => {
  const [addChargeRule] = useMutation(ADD_CHARGE_RULE);
  const [editChargeRule] = useMutation(EDIT_CHARGE_RULE);
  const [deleteChargeRule] = useMutation(DELETE_CHARGE_RULE);
  const [resetChargeRule] = useMutation(RESET_CHARGE_RULE);
  return { addChargeRule, editChargeRule, deleteChargeRule, resetChargeRule };
};
