import { gql } from "@apollo/client";

export const CREATE_CHANNEL = gql`
  mutation CreateChannel($input: CreateChannelInput!) {
    createChannel(input: $input) {
      id
      channelCode
      channelName
      isDefault
      status
    }
  }
`;

export const UPDATE_CHANNEL = gql`
  mutation UpdateChannel($id: ID!, $input: UpdateChannelInput!) {
    updateChannel(id: $id, input: $input) {
      id
      channelCode
      channelName
      isDefault
      status
    }
  }
`;

export const DELETE_CHANNEL = gql`
  mutation DeleteChannel($id: ID!) {
    deleteChannel(id: $id)
  }
`;

export const RESET_CHANNEL = gql`
  mutation ResetChannel($id: ID!) {
    resetChannel(id: $id)
  }
`;
