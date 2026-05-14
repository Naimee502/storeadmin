import mongoose from "mongoose";

const staffAccountSchema = new mongoose.Schema(
  {
    admin: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true },
    branchid: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", default: null },

    staffcode: { type: String },
    name: { type: String, required: true },
    mobile: { type: String, required: true },
    email: { type: String, required: true },
    password: { type: String },
    profilepicture: { type: String },
    imageurl: { type: String },
    address: { type: String },

    salary: { type: Number, default: 0 },
    commission: { type: Number, default: 0 },
    target: { type: Number, default: 0 },

    accountgroupid: { type: mongoose.Schema.Types.ObjectId, ref: "AccountGroup", default: null },
    ledgerid: { type: mongoose.Schema.Types.ObjectId, ref: "AccountLedger", default: null },

    role: {
      type: String,
      enum: ["staff", "salesman", "deliveryboy"],
      required: true
    },

    assignedChannels: [
      { type: mongoose.Schema.Types.ObjectId, ref: "Channel" }
    ],

    // Per-staff permission override. Resolution order at runtime:
    //   Staff.permissions > Branch.permissions > Admin.defaultPermissions.
    // A missing key means "inherit from parent".
    // Per-staff permission override. Resolution order at runtime:
    //   Staff.permissions > Branch.permissions > Admin.defaultPermissions.
    // A missing key means "inherit from parent".
    permissions: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    // Per-staff module allowance (set by Branch/Admin)
    allowedmodules: {
      type: [String],
      default: null,
    },

    status: { type: Boolean, default: true }
  },
  { timestamps: true }
);


// -------------------------------------
// 🔥 UNIQUE INDEXES
// -------------------------------------
staffAccountSchema.index({ admin: 1, staffcode: 1 }, { unique: true });
staffAccountSchema.index({ admin: 1, mobile: 1 }, { unique: true });
staffAccountSchema.index({ admin: 1, email: 1 }, { unique: true });


// -------------------------------------
// ⭐ PRE-SAVE HOOK
// -------------------------------------
staffAccountSchema.pre("save", async function (next) {
  const StaffAccount = mongoose.model("StaffAccount");
  const AccountLedger = mongoose.model("AccountLedger");
  const AccountGroup = mongoose.model("AccountGroup");

  try {
    // 1️⃣ Duplicate mobile/email check
    const exists = await StaffAccount.findOne({
      admin: this.admin,
      $or: [{ mobile: this.mobile }, { email: this.email }],
      _id: { $ne: this._id }
    });

    if (exists) throw new Error(`User already exists: ${exists.name}`);

    // 2️⃣ Auto-generate staffcode based on role
    if (this.isNew && !this.staffcode) {
      const prefix = {
        salesman: "#SAC",
        staff: "#STF",
        deliveryboy: "#DLV"
      }[this.role];

      const last = await StaffAccount.findOne({
        admin: this.admin,
        staffcode: { $regex: new RegExp(`^${prefix}\\d{4}$`) }
      }).sort({ staffcode: -1 });

      const lastNum = last?.staffcode ? parseInt(last.staffcode.replace(prefix, "")) : 0;
      this.staffcode = `${prefix}${String(lastNum + 1).padStart(4, "0")}`;
    }

    // 3️⃣ Common STAFF ACCOUNT group for ALL ROLES (staff, salesman, deliveryboy)
    let staffGroup = await AccountGroup.findOne({
      admin: this.admin,
      accountgroupname: "Staff Account"
    });

    if (!staffGroup) {
      staffGroup = await AccountGroup.create({
        admin: this.admin,
        accountgroupname: "Staff Account",
        category: "expenses",
        status: true
      });
    }

    if (!this.accountgroupid) {
      this.accountgroupid = staffGroup._id;
    }

    // 4️⃣ Create MAIN STAFF LEDGER for ALL ROLES
    if (this.isNew && !this.ledgerid) {
      const ledger = await AccountLedger.create({
        admin: this.admin,
        branchid: this.branchid || null,
        accountid: this._id,
        accountgroupid: this.accountgroupid,
        ledgername: `${this.name} - ${this.staffcode}`,
        openingbalance: 0,
        openingbalancetype: "debit",
        status: true
      });

      this.ledgerid = ledger._id;
    }

    // 5️⃣ SALESMAN-SPECIFIC: Commission Expense Ledger ONLY (no separate group)
    if (this.role === "salesman") {
      let expenseGroup = await AccountGroup.findOne({
        admin: this.admin,
        accountgroupname: "Commission Expense"
      });

      if (!expenseGroup) {
        expenseGroup = await AccountGroup.create({
          admin: this.admin,
          accountgroupname: "Commission Expense",
          category: "expenses",
          status: true
        });
      }

      const commissionLedger = await AccountLedger.findOne({
        admin: this.admin,
        ledgername: "Salesman Commission Expense"
      });

      if (!commissionLedger) {
        await AccountLedger.create({
          admin: this.admin,
          accountgroupid: expenseGroup._id,
          ledgername: "Salesman Commission Expense",
          openingbalance: 0,
          openingbalancetype: "debit",
          status: true
        });
      }
    }

    next();
  } catch (err: any) {
    next(err);
  }
});


// -------------------------------------
// 🔥 UPDATE HOOK – Update Ledger Name When Staff Name Changes
// -------------------------------------
staffAccountSchema.pre("findOneAndUpdate", async function (next) {
  const update = this.getUpdate() as mongoose.UpdateQuery<any>;
  if (!update || !update.name) return next();

  const docToUpdate = await this.model.findOne(this.getQuery());
  if (!docToUpdate) return next();

  const AccountLedger = mongoose.model("AccountLedger");

  // Update main ledger name
  if (docToUpdate.ledgerid) {
    await AccountLedger.updateOne(
      { _id: docToUpdate.ledgerid },
      { $set: { ledgername: `${update.name} - ${docToUpdate.staffcode}` } }
    );
  }

  next();
});


export const StaffAccount = mongoose.model("StaffAccount", staffAccountSchema);
