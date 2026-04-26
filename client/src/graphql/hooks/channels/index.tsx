import { useMutation, useQuery } from "@apollo/client";
import { GET_CHANNELS, GET_CHANNEL_BY_ID, GET_DELETED_CHANNELS } from "../../queries/channels";
import { CREATE_CHANNEL, UPDATE_CHANNEL, DELETE_CHANNEL, RESET_CHANNEL } from "../../mutations/channels";

export const useChannelsQuery = (adminId?: string) => {
  return useQuery(GET_CHANNELS, {
    variables: { adminId },
  });
};

export const useDeletedChannelsQuery = (adminId?: string) => {
  return useQuery(GET_DELETED_CHANNELS, {
    variables: { adminId },
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
