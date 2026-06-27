import { useMutation, useQuery } from "@apollo/client";
import { GET_CHANNELS, GET_CHANNEL_BY_ID, GET_DELETED_CHANNELS } from "../../queries/channels";
import { CREATE_CHANNEL, UPDATE_CHANNEL, DELETE_CHANNEL, RESET_CHANNEL } from "../../mutations/channels";
import { useAppSelector } from "../../../redux/hooks";

// Resolve the owning admin from auth. Callers may still pass an explicit
// adminId (e.g. Business Settings managing another admin); otherwise we scope
// to the logged-in admin so channels never leak across tenants.
const useResolvedAdminId = (override?: string) => {
  const { type, admin, branch, staff } = useAppSelector((state) => state.auth);
  if (override) return override;
  return type === "admin"
    ? admin?.id
    : type === "branch"
      ? branch?.admin?.id
      : type === "staff"
        ? staff?.admin?.id
        : undefined;
};

export const useChannelsQuery = (adminId?: string) => {
  const resolvedAdminId = useResolvedAdminId(adminId);
  return useQuery(GET_CHANNELS, {
    variables: { adminId: resolvedAdminId },
    skip: !resolvedAdminId,
  });
};

export const useDeletedChannelsQuery = (adminId?: string) => {
  const resolvedAdminId = useResolvedAdminId(adminId);
  return useQuery(GET_DELETED_CHANNELS, {
    variables: { adminId: resolvedAdminId },
    skip: !resolvedAdminId,
  });
};

export const useChannelByIdQuery = (id: string) => {
  return useQuery(GET_CHANNEL_BY_ID, {
    variables: { id },
    skip: !id,
  });
};

export const useCreateChannelMutation = () => useMutation(CREATE_CHANNEL);
export const useUpdateChannelMutation = () => useMutation(UPDATE_CHANNEL);
export const useDeleteChannelMutation = () => useMutation(DELETE_CHANNEL);
export const useResetChannelMutation = () => useMutation(RESET_CHANNEL);
