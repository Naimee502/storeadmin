import { useMutation, useQuery } from "@apollo/client";
import {
  CREATE_ADMIN,
  LOGIN_ADMIN,
  CONFIRM_SUBSCRIPTION,
  APPROVE_SUBSCRIPTION,
  REJECT_SUBSCRIPTION,
  GET_PENDING_SUBSCRIPTIONS, // ✅ import the new query
} from "../../mutations/admin"; // or from "../../queries/admin" if separated
import { GET_ADMINS } from "../../queries/admin";

// Mutation: Create Admin
export const useCreateAdminMutation = () => useMutation(CREATE_ADMIN);

// Mutation: Login Admin
export const useLoginAdminMutation = () => useMutation(LOGIN_ADMIN);

// Mutation: Confirm Subscription
export const useConfirmSubscriptionMutation = () => useMutation(CONFIRM_SUBSCRIPTION);

// Mutation: Approve Subscription
export const useApproveSubscriptionMutation = () => useMutation(APPROVE_SUBSCRIPTION);

// Mutation: Reject Subscription
export const useRejectSubscriptionMutation = () => useMutation(REJECT_SUBSCRIPTION);

// Query: Get Pending Subscriptions
export const usePendingSubscriptionsQuery = () => useQuery(GET_PENDING_SUBSCRIPTIONS);

// ✅ Query: Get All Admins
export const useGetAdminsQuery = () => useQuery(GET_ADMINS);
