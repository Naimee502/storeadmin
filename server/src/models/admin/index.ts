import mongoose, { Document, Schema } from "mongoose";
import { AccountGroup } from "../accountgroups";
import { defaultAccountGroups, defaultLedgers } from "../../utils/helper";
import { AccountLedger } from "../accountledgers";

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


// ✅ Auto-create Account Groups & Ledgers AFTER Admin created
AdminSchema.post("save", async function (doc, next) {
  try {
    // ────────────────────────
    // 1️⃣ Create Default Account Groups
    // ────────────────────────
    let groups = await AccountGroup.find({ admin: doc._id });

    if (groups.length === 0) {
      for (const g of defaultAccountGroups) {
        const newGroup = new AccountGroup({
          accountgroupname: g.name,
          category: g.category,
          admin: doc._id,
        });
        await newGroup.save(); // ✅ triggers pre-save
      }
      groups = await AccountGroup.find({ admin: doc._id });
    }

    // ────────────────────────
    // 2️⃣ Create Default Ledgers
    // ────────────────────────
    const ledgerExists = await AccountLedger.countDocuments({ admin: doc._id });

    if (ledgerExists === 0) {
      const groupMap = Object.fromEntries(
        groups.map((g) => [g.accountgroupname.trim().toLowerCase(), g._id])
      );

      for (const entry of defaultLedgers) {
        const groupId = groupMap[entry.group.trim().toLowerCase()] || groups[0]._id;

        const ledger = new AccountLedger({
          ledgername: entry.name,
          accountgroupid: groupId,
          admin: doc._id,
          branchid: null,
        });

        await ledger.save(); // ✅ triggers auto ledgercode
      }
    }

    next();
  } catch (error: any) {
    console.error("Admin post-save error:", error);
    next(error);
  }
});

// Export the model with the inline type
export const Admin = mongoose.model<IAdmin>("Admin", AdminSchema);
