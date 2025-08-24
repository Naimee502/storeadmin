import { useMutation, useQuery } from "@apollo/client";
import {
  CREATE_ADMIN,
  LOGIN_ADMIN,
  CONFIRM_SUBSCRIPTION,
  APPROVE_SUBSCRIPTION,
  REJECT_SUBSCRIPTION,
  GET_PENDING_SUBSCRIPTIONS,
  UPDATE_ADMIN_BY_ID,
  DELETE_ADMIN,
  RESET_ADMIN, // ✅ import the new query
} from "../../mutations/admin"; // or from "../../queries/admin" if separated
import { GET_ADMINS, GET_DELETED_ADMINS } from "../../queries/admin";

// Mutation: Create Admin
export const useCreateAdminMutation = () => useMutation(CREATE_ADMIN);

// Mutation: Update Admin
export const useUpdateAdminMutation = () => useMutation(UPDATE_ADMIN_BY_ID);

// Mutation: Login Admin
export const useLoginAdminMutation = () => useMutation(LOGIN_ADMIN);

// Mutation: Delete Admin
export const useDeleteAdminMutation = () => useMutation(DELETE_ADMIN);

// Mutation: Confirm Subscription
export const useConfirmSubscriptionMutation = () => useMutation(CONFIRM_SUBSCRIPTION);

// Mutation: Approve Subscription
export const useApproveSubscriptionMutation = () => useMutation(APPROVE_SUBSCRIPTION);

// Mutation: Reject Subscription
export const useRejectSubscriptionMutation = () => useMutation(REJECT_SUBSCRIPTION);

// Query: Get Pending Subscriptions
export const usePendingSubscriptionsQuery = () => useQuery(GET_PENDING_SUBSCRIPTIONS);

// ✅ Query: Get All Admins
export const useAdminsQuery = () => {
  const { data, loading, error, refetch } = useQuery(GET_ADMINS);

  return {
    data,
    loading,
    error,
    refetch,
  };
};

// ✅ Query: Get Deleted Admins
export const useGetDeletedAdminsQuery = (adminId?: string) =>
  useQuery(GET_DELETED_ADMINS, {
    variables: adminId ? { adminId } : {},
});

//
export const useResetAdminMutation = () => useMutation(RESET_ADMIN);


