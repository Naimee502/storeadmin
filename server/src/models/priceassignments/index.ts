import mongoose, { Schema, Document, Types } from "mongoose";

export interface IPriceAssignment extends Document {
  clientRequestId?: string;
  adminid: Types.ObjectId;
  pricelistid: Types.ObjectId;
  targettype: "customer" | "channel" | "region" | "route" | "channel_region";
  targetid?: Types.ObjectId | string; // Account ID, Channel ID, or Region string
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
      enum: ["customer", "channel", "region", "route", "channel_region"], 
      required: true 
    },
    targetid: { type: Schema.Types.Mixed, required: true },
    status: { type: Boolean, default: true },
  },
  { timestamps: true }
);

priceAssignmentSchema.index({ adminid: 1, targettype: 1, targetid: 1 });

// Offline sync: one document per request id; only rows that carry one are indexed.
priceAssignmentSchema.add({ clientRequestId: { type: String } });
priceAssignmentSchema.index({ adminid: 1, clientRequestId: 1 }, { unique: true, partialFilterExpression: { clientRequestId: { $type: "string" } } });

export const PriceAssignment = mongoose.model<IPriceAssignment>("PriceAssignment", priceAssignmentSchema);
