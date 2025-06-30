import mongoose from 'mongoose';

const accountSchema = new mongoose.Schema(
  {
    branchid: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
    accountcode: { type: String, unique: true },
    name: { type: String, required: true },
    accountgroupid: { type: String, required: true },
    mobile: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    address: { type: String },
    city: { type: String },
    pincode: { type: String },
    status: Boolean,
    admin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      required: true,
    },
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
