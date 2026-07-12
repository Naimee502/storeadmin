import mongoose, { Document, Schema } from "mongoose";
import { AccountGroup } from "../accountgroups";
import { defaultAccountGroups, defaultLedgers } from "../../utils/helper";
import { AccountLedger } from "../accountledgers";

// Extend the Admin interface
interface IAdmin extends Document {
  admincode: string;
  name: string;
  email: string;
  password: string;
  companyName: string;
  mobile: string;
  noOfBranches: number;
  subscriptionType: "monthly" | "yearly" | "lifetime" | null;
  subscribed: boolean;
  subscribedAt: Date | null;
  subscriptionEnd: Date | null;
  transactionId: string | null;
  needsReview: boolean;
  rejected: boolean;
  businesstype: "retail" | "wholesale" | "manufacturer" | "service" | "trader" | "exporter" | "other";
  allowedmodules: string[];
  // Per-module action defaults that propagate to every Branch / Staff
  // under this admin unless overridden. Stored as Mixed JSON because the
  // action set evolves over time and we don't want to migrate the schema
  // on each addition.
  defaultPermissions: Record<string, Record<string, boolean>>;
  createdAt: Date;
  updatedAt: Date;
  status: Boolean,
}

// Define the schema
const AdminSchema: Schema<IAdmin> = new mongoose.Schema(
  {
    // Auto-generated unique code (#ADM0001, #ADM0002, ...) — same pattern as
    // staffcode/#SAC, payment/#PAY etc. used across the other modules.
    admincode: { type: String, unique: true, sparse: true },
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    companyName: { type: String, required: true },
    mobile: { type: String, required: true },
    noOfBranches: { type: Number, default: 1 },

    // Subscription
    subscriptionType: {
      type: String,
      enum: ["monthly", "yearly", "lifetime"],
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
    allowedmodules: {
      type: [String],
      default: null,
    },

    // Default permission template applied to every Branch/Staff under this
    // admin unless they override individually. Shape:
    //   { <module>: { view, add, edit, delete, print, return, cancel,
    //                 convert, whatsapp, import, export } }
    // Stored as Mixed because the action set may grow over time and we
    // don't want to migrate the schema on each addition.
    defaultPermissions: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    status: { type: Boolean, default: true },
  },
  { timestamps: true }
);


// ✅ Auto-generate admincode (#ADM0001) BEFORE save — mirrors staffcode logic
AdminSchema.pre("save", async function (next) {
  try {
    if (!this.admincode) {
      const prefix = "#ADM";
      const last = await Admin.findOne({
        admincode: { $regex: new RegExp(`^${prefix}\\d{4}$`) },
      }).sort({ admincode: -1 });
      const lastNum = last?.admincode ? parseInt(last.admincode.replace(prefix, "")) : 0;
      this.admincode = `${prefix}${String(lastNum + 1).padStart(4, "0")}`;
    }
    next();
  } catch (error: any) {
    console.error("Admin pre-save (admincode) error:", error);
    next(error);
  }
});

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
        await newGroup.save();
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

      for (let i = 0; i < defaultLedgers.length; i++) {
        const entry = defaultLedgers[i];
        const groupId = groupMap[entry.group.trim().toLowerCase()] || groups[0]._id;

        const ledger = new AccountLedger({
          ledgername: entry.name,
          accountgroupid: groupId,
          admin: doc._id,
          branchid: null,
        });

        await ledger.save();
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
