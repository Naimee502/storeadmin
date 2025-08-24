import mongoose, { Document, Schema } from "mongoose";

// Extend the Admin interface
interface IAdmin extends Document {
  name: string;
  email: string;
  password: string;
  subscriptionType: "monthly" | "yearly" | null;
  subscribed: boolean;
  subscribedAt: Date | null;
  subscriptionEnd: Date | null;
  transactionId: string | null;
  needsReview: boolean;
  rejected: boolean;
  businesstype: "retail" | "wholesale" | "manufacturer" | "service" | "trader" | "exporter" | "other";
  isMultibranch: boolean;
  isChannelCustomers: boolean; // <-- Added
  allowedmodules: string[];
  createdAt: Date;
  updatedAt: Date;
  status: Boolean,
}

// Define the schema
const AdminSchema: Schema<IAdmin> = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },

    // Subscription
    subscriptionType: {
      type: String,
      enum: ["monthly", "yearly"],
      default: "monthly",
    },
    subscribed: { type: Boolean, default: false },
    subscribedAt: { type: Date, default: null },
    subscriptionEnd: { type: Date, default: null },
    transactionId: { type: String, default: null },
    needsReview: { type: Boolean, default: false },
    rejected: { type: Boolean, default: false },

    // Business Configuration
    businesstype: {
      type: String,
      enum: ['retail', 'wholesale', 'manufacturer', 'service', 'trader', 'other'],
      default: 'retail',
    },
    isMultibranch: { type: Boolean, default: false },
    isChannelCustomers: { type: Boolean, default: false },
    allowedmodules: {
      type: [String],
      enum: [
        'sales',
        'purchase',
        'inventory',
        'accounting',
        'pos',
        'manufacturing',
        'service',
        'reports',
      ],
      default: ['sales', 'purchase', 'accounting'],
    },
    status: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Export the model with the inline type
export const Admin = mongoose.model<IAdmin>("Admin", AdminSchema);
