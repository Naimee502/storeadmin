import { gql } from "apollo-server-express";

export const announcementTypeDefs = gql`
  type AnnouncementAudience {
    everyone: Boolean
    staffAll: Boolean
    staffRoles: [String!]
    staffIds: [ID!]
    partyAll: Boolean
    partyChannels: [ID!]
    partyIds: [ID!]
    myParties: Boolean
    mySubParties: Boolean
  }

  input AnnouncementAudienceInput {
    everyone: Boolean
    staffAll: Boolean
    staffRoles: [String!]
    staffIds: [ID!]
    partyAll: Boolean
    partyChannels: [ID!]
    partyIds: [ID!]
    myParties: Boolean
    mySubParties: Boolean
  }

  type Announcement {
    id: ID!
    adminid: ID!
    branchid: ID
    title: String!
    message: String
    imageurl: String
    link: String
    priority: String
    startAt: String
    expireAt: String
    audience: AnnouncementAudience
    # Plain-language summary of the audience, e.g. "All salesmen, 3 parties".
    audienceLabel: String
    sendertype: String
    senderid: ID
    sendername: String
    recipientcount: Int
    readcount: Int
    # For the viewer's own feed only.
    read: Boolean
    isactive: Boolean
    createdAt: String
    updatedAt: String
  }

  input AnnouncementInput {
    title: String!
    message: String
    imageurl: String
    link: String
    priority: String
    startAt: String
    expireAt: String
    # Admin only — limit to one branch. Branch logins are always their own branch.
    branchid: ID
    audience: AnnouncementAudienceInput!
  }

  # People a sender may pick from — already limited to what that sender is allowed to target.
  type AnnouncementTargetOption {
    id: ID!
    name: String!
    sub: String
  }

  # One person who opened an announcement — for the admin's "Seen by" list.
  type AnnouncementReader {
    id: ID!
    readertype: String!
    name: String!
    mobile: String
    city: String
    # salesman / deliveryboy / staff for staff readers.
    role: String
    # "app", "website" — where they opened it (empty for older reads).
    sources: [String!]!
    readAt: String
  }

  type AnnouncementTargets {
    staff: [AnnouncementTargetOption!]!
    parties: [AnnouncementTargetOption!]!
    channels: [AnnouncementTargetOption!]!
  }

  type Query {
    isAnnouncementsEnabled: Boolean!
    # Admin panel list (admin: everything, branch: its own, staff: what it sent).
    getAnnouncements: [Announcement!]!
    getDeletedAnnouncements: [Announcement!]!
    # The signed-in staff member's / party's feed.
    getMyAnnouncements: [Announcement!]!
    # What the signed-in salesman / party has sent.
    getSentAnnouncements: [Announcement!]!
    getAnnouncementTargets: AnnouncementTargets!
    # Who has seen one announcement (sender / admin / branch only).
    getAnnouncementReaders(id: ID!): [AnnouncementReader!]!
  }

  type Mutation {
    addAnnouncement(input: AnnouncementInput!): Announcement!
    editAnnouncement(id: ID!, input: AnnouncementInput!): Announcement!
    deleteAnnouncement(id: ID!): Boolean!
    resetAnnouncement(id: ID!): Boolean!
    # source: "app" or "website".
    markAnnouncementRead(id: ID!, source: String): Boolean!
  }
`;
