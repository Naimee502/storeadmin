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
  address: string;
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
    address: { type: String, default: "" },
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

// Default account groups and ledgers: every save adds only the ones this business is missing
// (matched by name, any case, deleted ones included), so older businesses get new defaults and nothing is duplicated.
const keyOf = (name: string) => String(name || "").trim().toLowerCase();

AdminSchema.post("save", async function (doc, next) {
  try {
    const groups: any[] = await AccountGroup.find({ admin: doc._id }).select("accountgroupname").lean();
    const groupIds = new Map(groups.map((g) => [keyOf(g.accountgroupname), g._id]));
    for (const g of defaultAccountGroups) {
      if (groupIds.has(keyOf(g.name))) continue;
      try {
        const created: any = await new AccountGroup({ accountgroupname: g.name, category: g.category, admin: doc._id }).save();
        groupIds.set(keyOf(g.name), created._id);
      } catch (e: any) {
        if (!/E11000/.test(String(e?.message))) throw e;
      }
    }

    const ledgers: any[] = await AccountLedger.find({ admin: doc._id }).select("ledgername").lean();
    const have = new Set(ledgers.map((l) => keyOf(l.ledgername)));
    const fallbackGroup = groupIds.values().next().value;
    for (const entry of defaultLedgers) {
      if (have.has(keyOf(entry.name))) continue;
      try {
        await new AccountLedger({
          ledgername: entry.name,
          accountgroupid: groupIds.get(keyOf(entry.group)) || fallbackGroup,
          admin: doc._id,
          branchid: null,
        }).save();
        have.add(keyOf(entry.name));
      } catch (e: any) {
        // Saved at the same moment by another request: already there.
        if (!/E11000/.test(String(e?.message))) throw e;
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
