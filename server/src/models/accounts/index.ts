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
      required: true,
    },

    name: { type: String, required: true }, 

    type: {
      type: String,
      enum: ['customer', 'vendor', 'expense', 'bank', 'other'],
      required: true,
      default: 'customer',
    },

    accounttype: {
      type: String,
      enum: [
        'enduser',
        'retail',
        'dealer',
        'superstockist',
        'distributor',
        'manufacturer',
        'exporter',
      ],
      default: 'retail',
    },

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

    isposcustomer: { type: Boolean, default: false },

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

  if (newName) {
    const doc = await this.model.findOne(this.getQuery());
    if (doc && doc.ledgerid) {
      await AccountLedger.updateOne(
        { _id: doc.ledgerid },
        { $set: { ledgername: `${newName} - ${doc.accountcode}` } }
      );
    }
  }

  next();
});

export const Account = mongoose.model('Account', accountSchema);
