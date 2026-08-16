import mongoose from 'mongoose';

const accountSchema = new mongoose.Schema(
  {
    // Ownership
    admin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      required: true,
    },
    branchid: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      default: null,
    },

    name: { type: String, required: true }, 

    type: {
      type: String,
      enum: ['customer', 'vendor', 'expense', 'bank', 'other'],
      required: true,
      default: 'customer',
    },


    channel: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Channel',
      default: null,
    },

    region: { type: String },

    accountgroupid: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AccountGroup',
      required: true,
    },

    ledgerid: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AccountLedger',
      default: null
    },

    // Identity & Contact
    accountcode: { type: String },
    mobile: { type: String },
    email: { type: String },
    gstnumber: { type: String },
    pan: { type: String },
    address: { type: String },
    city: { type: String },
    state: {
      type: String,
      enum: [
        "default",
        "andhra_pradesh","arunachal_pradesh","assam","bihar","chhattisgarh",
        "goa","gujarat","haryana","himachal_pradesh","jharkhand","karnataka",
        "kerala","madhya_pradesh","maharashtra","manipur","meghalaya","mizoram",
        "nagaland","odisha","punjab","rajasthan","sikkim","tamil_nadu",
        "telangana","tripura","uttar_pradesh","uttarakhand","west_bengal",
        "andaman_nicobar","chandigarh","dadra_nagar_haveli_daman_diu","delhi",
        "jammu_kashmir","ladakh","lakshadweep","puducherry",
        "international"
      ],
      default: "default"
    },
    country: { type: String, default: 'India' },
    pincode: { type: String },

    // Accounting Info
    openingbalance: { type: Number, default: 0 },
    openingbalancetype: {
      type: String,
      enum: ['debit', 'credit'],
      default: 'debit',
    },
    creditlimit: { type: Number, default: 0 },

    // Bank Details
    bankname: { type: String },
    bankaccountnumber: { type: String },
    ifsc: { type: String },
    upiid: { type: String },

    // Settings
    billingcycle: {
      type: String,
      enum: ['weekly', 'monthly', 'custom'],
      default: 'monthly',
    },
    duedays: { type: Number, default: 0 },

    //is Channel Customer in Admin True
    assignaccountid: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Account', // assumes other account used as channel reference
    },

    salesmanid: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'StaffAccount',
    },

    latitude: { type: Number },
    longitude: { type: Number },

    otp: { type: String },
    otpExpiry: { type: Date },

    status: { type: Boolean, default: true },
  },
  { timestamps: true }
);

accountSchema.index({ admin: 1, accountcode: 1 }, { unique: true });

// ------------------ PRE SAVE HOOK ------------------
accountSchema.pre("save", async function (next) {
  try {
    const Account = mongoose.model("Account");
    const AccountLedger = mongoose.model("AccountLedger");

    // 1️⃣ Generate Account Code
    if (this.isNew && !this.accountcode) {
      const last = await Account.findOne({
        admin: this.admin,
        accountcode: { $regex: /^#ACC\d{4}$/ },
      }).sort({ accountcode: -1 });

      const lastNum = last?.accountcode
        ? parseInt(last.accountcode.replace("#ACC", ""))
        : 0;

      this.accountcode = `#ACC${String(lastNum + 1).padStart(4, "0")}`;
    }

    // 2️⃣ Create Ledger BEFORE Saving
    if (this.isNew && !this.ledgerid) {
      const ledger = await AccountLedger.create({
        admin: this.admin,
        branchid: this.branchid || null,
        accountid: this._id,
        accountgroupid: this.accountgroupid,
        ledgername: `${this.name} - ${this.accountcode}`,
        openingbalance: this.openingbalance,
        openingbalancetype: this.openingbalancetype,
        status: true,
      });

      this.ledgerid = ledger._id; // ✔ assign BEFORE save completes
    }

    next();
  } catch (err:any) {
    next(err);
  }
});

// ------------------ PRE FINDONEANDUPDATE HOOK ------------------
accountSchema.pre('findOneAndUpdate', async function (next) {
  const update = this.getUpdate() as mongoose.UpdateQuery<any> | undefined;
  if (!update) return next();

  const AccountLedger = mongoose.model('AccountLedger');

  let newName: string | undefined;

  if ('$set' in update && typeof update.$set?.name === 'string') {
    newName = update.$set.name;
  } else if (typeof update.name === 'string') {
    newName = update.name;
  }

  // The ledger mirrors the account, so anything the user edits on the account
  // form has to be pushed across. Only the NAME used to be synced: an account
  // created with a 0 opening balance and later edited to 1000 left the ledger
  // sitting at 0. Every accounting read (party report, payment allocation,
  // outstanding) takes the ledger as authoritative, so the 1000 was invisible
  // everywhere except the edit form the user typed it into.
  const pick = (k: string) => {
    if ('$set' in update && update.$set?.[k] !== undefined) return update.$set[k];
    return (update as any)[k];
  };
  const newOpening = pick('openingbalance');
  const newOpeningType = pick('openingbalancetype');
  const newGroup = pick('accountgroupid');

  const touchesLedger =
    !!newName ||
    newOpening !== undefined ||
    newOpeningType !== undefined ||
    newGroup !== undefined;

  if (touchesLedger) {
    const doc = await this.model.findOne(this.getQuery());
    if (doc && doc.ledgerid) {
      const $set: Record<string, any> = {};
      if (newName) $set.ledgername = `${newName} - ${doc.accountcode}`;
      if (newOpening !== undefined) $set.openingbalance = newOpening;
      if (newOpeningType !== undefined) $set.openingbalancetype = newOpeningType;
      if (newGroup !== undefined) $set.accountgroupid = newGroup;
      if (Object.keys($set).length) {
        await AccountLedger.updateOne({ _id: doc.ledgerid }, { $set });
      }
    }
  }

  next();
});

export const Account = mongoose.model('Account', accountSchema);
