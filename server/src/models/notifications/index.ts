import mongoose, { Document, Schema } from "mongoose";

// Business-event notifications.
// target:
//   - { targettype: "admin" }                → shown on the admin web panel bell
//   - { targettype: "staff", targetid }      → shown in the mobile app for that staff/salesman
//   - { targettype: "party", targetid }      → shown in the mobile app for that party login
export interface INotification extends Document {
  adminid: mongoose.Types.ObjectId;
  branchid?: mongoose.Types.ObjectId | null;
  targettype: "admin" | "staff" | "party";
  targetid?: mongoose.Types.ObjectId | null;
  ntype: string; // order | invoice | payment | system
  title: string;
  message?: string;
  webpath?: string; // admin panel redirect path (e.g. /salesorder)
  appscreen?: string; // app redirect hint (e.g. Orders / Payments)
  docmodel?: string;
  docid?: mongoose.Types.ObjectId | null;
  read: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema: Schema<INotification> = new mongoose.Schema(
  {
    adminid: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true },
    branchid: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", default: null },
    targettype: { type: String, enum: ["admin", "staff", "party"], required: true },
    targetid: { type: mongoose.Schema.Types.ObjectId, default: null },
    ntype: { type: String, default: "system" },
    title: { type: String, required: true },
    message: { type: String, default: "" },
    webpath: { type: String, default: "" },
    appscreen: { type: String, default: "" },
    docmodel: { type: String, default: "" },
    docid: { type: mongoose.Schema.Types.ObjectId, default: null },
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

NotificationSchema.index({ adminid: 1, targettype: 1, targetid: 1, read: 1, createdAt: -1 });

export const Notification = mongoose.model<INotification>("Notification", NotificationSchema);

// Fire-and-forget helper — never let a notification failure break the
// business mutation that triggered it.
export const pushNotification = async (data: {
  adminid: any;
  branchid?: any;
  targettype: "admin" | "staff" | "party";
  targetid?: any;
  ntype: string;
  title: string;
  message?: string;
  webpath?: string;
  appscreen?: string;
  docmodel?: string;
  docid?: any;
}) => {
  try {
    if (!data.adminid || !data.title) return;
    if (data.targettype !== "admin" && !data.targetid) return;
    await Notification.create(data);
  } catch (err) {
    console.error("pushNotification failed:", err);
  }
};
