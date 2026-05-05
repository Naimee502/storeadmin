import mongoose, { Schema, Document, Types } from "mongoose";

export interface IPriceAssignment extends Document {
  adminid: Types.ObjectId;
  pricelistid: Types.ObjectId;
  targettype: "customer" | "channel" | "region" | "route";
  targetid?: Types.ObjectId | string; // Account ID, Channel ID, or Region string
  priority: number; // 1 (highest) to 5 (lowest)
  status: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const priceAssignmentSchema = new Schema<IPriceAssignment>(
  {
    adminid: { type: Schema.Types.ObjectId, ref: "Admin", required: true },
    pricelistid: { type: Schema.Types.ObjectId, ref: "PriceList", required: true },
    targettype: { 
      type: String, 
      enum: ["customer", "channel", "region", "route"], 
      required: true 
    },
    targetid: { type: Schema.Types.Mixed, required: true },
    priority: { type: Number, default: 5 },
    status: { type: Boolean, default: true },
  },
  { timestamps: true }
);

priceAssignmentSchema.index({ adminid: 1, targettype: 1, targetid: 1 });

export const PriceAssignment = mongoose.model<IPriceAssignment>("PriceAssignment", priceAssignmentSchema);
