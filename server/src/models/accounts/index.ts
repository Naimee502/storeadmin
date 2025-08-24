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

    // Classification
    name: { type: String, required: true }, // Party Name

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

    // Identity & Contact
    accountcode: { type: String, unique: true, sparse: true },
    mobile: { type: String },
    email: { type: String },
    gstnumber: { type: String },
    pan: { type: String },
    address: { type: String },
    city: { type: String },
    state: { type: String },
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
      ref: 'SalesmenAccount',
    },

    latitude: { type: Number },
    longitude: { type: Number },

    otp: { type: String },

    status: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Auto-generate accountcode before saving
accountSchema.pre('save', async function (next) {
  if (!this.accountcode) {
    const Account = mongoose.model('Account');
    const lastAccount = await Account.findOne({ accountcode: { $regex: /^#ACC\d{4}$/ } })
      .sort({ accountcode: -1 })
      .exec();

    let nextNumber = 1;
    if (lastAccount?.accountcode) {
      const lastNumber = parseInt(lastAccount.accountcode.replace('#ACC', ''), 10);
      if (!isNaN(lastNumber)) {
        nextNumber = lastNumber + 1;
      }
    }

    this.accountcode = `#ACC${nextNumber.toString().padStart(4, '0')}`;
  }
  next();
});

export const Account = mongoose.model('Account', accountSchema);
