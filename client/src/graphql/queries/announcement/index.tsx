import { gql } from "@apollo/client";

export const ANNOUNCEMENT_FIELDS = `
  id
  branchid
  title
  message
  imageurl
  link
  priority
  startAt
  expireAt
  audience {
    everyone staffAll staffRoles staffIds partyAll partyChannels partyIds myParties mySubParties
  }
  audienceLabel
  sendertype
  senderid
  sendername
  recipientcount
  readcount
  isactive
  createdAt
`;

export const GET_ANNOUNCEMENTS = gql`
  query GetAnnouncements { getAnnouncements { ${ANNOUNCEMENT_FIELDS} } }
`;

export const GET_DELETED_ANNOUNCEMENTS = gql`
  query GetDeletedAnnouncements { getDeletedAnnouncements { ${ANNOUNCEMENT_FIELDS} } }
`;

export const GET_ANNOUNCEMENT_TARGETS = gql`
  query GetAnnouncementTargets {
    getAnnouncementTargets {
      staff { id name sub }
      parties { id name sub }
      channels { id name }
    }
  }
`;

export const ADD_ANNOUNCEMENT = gql`
  mutation AddAnnouncement($input: AnnouncementInput!) { addAnnouncement(input: $input) { ${ANNOUNCEMENT_FIELDS} } }
`;

export const EDIT_ANNOUNCEMENT = gql`
  mutation EditAnnouncement($id: ID!, $input: AnnouncementInput!) { editAnnouncement(id: $id, input: $input) { ${ANNOUNCEMENT_FIELDS} } }
`;

export const DELETE_ANNOUNCEMENT = gql`
  mutation DeleteAnnouncement($id: ID!) { deleteAnnouncement(id: $id) }
`;

export const RESET_ANNOUNCEMENT = gql`
  mutation ResetAnnouncement($id: ID!) { resetAnnouncement(id: $id) }
`;
