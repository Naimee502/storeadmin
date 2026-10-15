import mongoose from "mongoose";

/* ===========================================================
   ANNOUNCEMENT

   A message from the business (admin / branch), a salesman, or a channel
   party to a chosen audience, shown in the app and on the website.

   The audience is stored as RULES, not as a list of people, and matched when
   someone opens their feed. A salesman who joins next week still sees a
   "to all salesmen" announcement that is running; nobody has to re-send it.

   Who may target whom (enforced in the resolver, never trusted from input):
     admin    → anyone in the business (optionally one branch)
     branch   → its own branch's staff and parties only
     salesman → only parties assigned to him (Account.salesmanid)
     party    → only its own sub-parties (Account.assignaccountid)
   =========================================================== */

const audienceSchema = new mongoose.Schema(
  {
    // Every staff member and every party in scope.
    everyone: { type: Boolean, default: false },

    // Staff side
    staffAll: { type: Boolean, default: false },
    staffRoles: { type: [String], default: [] }, // salesman | deliveryboy | staff
    staffIds: { type: [mongoose.Schema.Types.ObjectId], default: [] },

    // Party side
    partyAll: { type: Boolean, default: false },
    partyChannels: { type: [mongoose.Schema.Types.ObjectId], default: [] },
    partyIds: { type: [mongoose.Schema.Types.ObjectId], default: [] },

    // Sender-relative groups
    myParties: { type: Boolean, default: false }, // salesman → all his parties
    mySubParties: { type: Boolean, default: false }, // party → all its sub-parties
  },
  { _id: false }
);

const announcementSchema = new mongoose.Schema(
  {
    adminid: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true, index: true },
    // null = the whole business. Set for branch-sent announcements, or when
    // the admin limits one to a branch.
    branchid: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", default: null, index: true },

    title: { type: String, required: true, trim: true },
    message: { type: String, default: "" },
    imageurl: { type: String, default: "" },
    link: { type: String, default: "" },
    // "important" pops up once when the app opens.
    priority: { type: String, enum: ["normal", "important"], default: "normal" },

    startAt: { type: Date, default: Date.now, index: true },
    expireAt: { type: Date, default: null, index: true },

    audience: { type: audienceSchema, default: () => ({}) },

    sendertype: { type: String, enum: ["admin", "branch", "staff", "party"], required: true },
    senderid: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    sendername: { type: String, default: "" },

    // Resolved once at send time — "seen by X of Y".
    recipientcount: { type: Number, default: 0 },
    pushsent: { type: Boolean, default: false },

    isactive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

announcementSchema.index({ adminid: 1, isactive: 1, startAt: -1 });

export const Announcement = mongoose.model("Announcement", announcementSchema);

/* One row per person who opened an announcement. */
const announcementReadSchema = new mongoose.Schema(
  {
    announcementid: { type: mongoose.Schema.Types.ObjectId, ref: "Announcement", required: true },
    readertype: { type: String, enum: ["staff", "party"], required: true },
    readerid: { type: mongoose.Schema.Types.ObjectId, required: true },
    // Where it was opened — "app" and/or "website". Empty on rows saved
    // before this was tracked.
    sources: { type: [String], default: [] },
  },
  { timestamps: true }
);
announcementReadSchema.index({ announcementid: 1, readertype: 1, readerid: 1 }, { unique: true });
announcementReadSchema.index({ readerid: 1 });

export const AnnouncementRead = mongoose.model("AnnouncementRead", announcementReadSchema);
