import { useMutation } from "@apollo/client";
import {
  CREATE_ADMIN,
  LOGIN_ADMIN,
  CONFIRM_SUBSCRIPTION,
} from "../../mutations/admin";

export const useCreateAdminMutation = () => {
  return useMutation(CREATE_ADMIN);
};

export const useConfirmSubscriptionMutation = () => {
  return useMutation(CONFIRM_SUBSCRIPTION);
};

export const useLoginAdminMutation = () => {
  return useMutation(LOGIN_ADMIN);
};


