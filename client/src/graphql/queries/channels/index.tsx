import { gql } from "@apollo/client";

export const GET_CHANNELS = gql`
  query GetChannels($adminId: ID) {
    getChannels(adminId: $adminId) {
      id
      channelCode
      channelName
      isDefault
      handlesChannels { id channelName }
      status
    }
  }
`;

export const GET_DELETED_CHANNELS = gql`
  query GetDeletedChannels($adminId: ID) {
    getDeletedChannels(adminId: $adminId) {
      id
      channelCode
      channelName
      isDefault
      handlesChannels { id channelName }
      status
    }
  }
`;

export const GET_CHANNEL_BY_ID = gql`
  query GetChannelById($id: ID!) {
    getChannelById(id: $id) {
      id
      channelCode
      channelName
      isDefault
      handlesChannels { id channelName }
      status
    }
  }
`;
