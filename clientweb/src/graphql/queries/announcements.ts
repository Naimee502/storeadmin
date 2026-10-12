import { gql } from "@apollo/client";

const FIELDS = `
  id
  title
  message
  imageurl
  link
  priority
  startAt
  audienceLabel
  sendertype
  sendername
  recipientcount
  readcount
  read
`;

export const GET_MY_ANNOUNCEMENTS = gql`
  query GetMyAnnouncements { getMyAnnouncements { ${FIELDS} } }
`;

export const GET_SENT_ANNOUNCEMENTS = gql`
  query GetSentAnnouncements { getSentAnnouncements { ${FIELDS} } }
`;

export const GET_ANNOUNCEMENT_TARGETS = gql`
  query GetAnnouncementTargets { getAnnouncementTargets { parties { id name sub } } }
`;

export const ADD_ANNOUNCEMENT = gql`
  mutation AddAnnouncement($input: AnnouncementInput!) { addAnnouncement(input: $input) { ${FIELDS} } }
`;

export const DELETE_ANNOUNCEMENT = gql`
  mutation DeleteAnnouncement($id: ID!) { deleteAnnouncement(id: $id) }
`;

export const MARK_ANNOUNCEMENT_READ = gql`
  mutation MarkAnnouncementRead($id: ID!) { markAnnouncementRead(id: $id) }
`;

export const IS_ANNOUNCEMENTS_ENABLED = gql`
  query IsAnnouncementsEnabled { isAnnouncementsEnabled }
`;
