import mongoose, { Document, Schema } from "mongoose";

// Define the interface inline
interface IAdmin extends Document {
  name: string;
  email: string;
  password: string;
  subscriptionType: "monthly" | "yearly";
  subscribed: boolean;
  subscribedAt: Date | null;
  subscriptionEnd: Date | null;
  transactionId: string | null;
  needsReview: boolean;
  rejected: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Define the schema
const AdminSchema: Schema<IAdmin> = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    subscriptionType: {
      type: String,
      enum: ["monthly", "yearly"],
      required: false,
    },
    subscribed: { type: Boolean, default: false },
    subscribedAt: { type: Date, default: null },
    subscriptionEnd: { type: Date, default: null },
    transactionId: { type: String, default: null },
    needsReview: { type: Boolean, default: false },
    rejected: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Export the model with the inline type
export const Admin = mongoose.model<IAdmin>("Admin", AdminSchema);
