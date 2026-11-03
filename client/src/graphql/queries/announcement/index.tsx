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

/**
 * Admin-panel list page only — just what the table, the picture preview and
 * the "Seen by" modal show. The edit form loads the full announcement
 * (audience ids, link, branch) by id with GET_ANNOUNCEMENT when Edit is
 * clicked. GET_ANNOUNCEMENTS above is left as is for anything else using it.
 */
export const GET_ANNOUNCEMENTS_LIST = gql`
  query GetAnnouncementsList {
    getAnnouncements {
      id
      title
      message
      imageurl
      priority
      startAt
      expireAt
      audienceLabel
      sendertype
      senderid
      sendername
      recipientcount
      readcount
    }
  }
`;

export const GET_ANNOUNCEMENT = gql`
  query GetAnnouncement($id: ID!) { getAnnouncement(id: $id) { ${ANNOUNCEMENT_FIELDS} } }
`;

export const GET_DELETED_ANNOUNCEMENTS = gql`
  query GetDeletedAnnouncements { getDeletedAnnouncements { ${ANNOUNCEMENT_FIELDS} } }
`;

export const GET_ANNOUNCEMENT_READERS = gql`
  query GetAnnouncementReaders($id: ID!) {
    getAnnouncementReaders(id: $id) { id readertype name mobile city role sources readAt }
  }
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
