import mongoose from 'mongoose';

const accountGroupSchema = new mongoose.Schema(
  {
    accountgroupcode: { type: String },
    accountgroupname: { type: String, required: true },
    category: {
      type: String,
      enum: ['assets', 'liabilities', 'income', 'expenses'],
      required: true,
    },
    status: { type: Boolean, default: true },
    admin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      required: true,
    },
  },
  { timestamps: true }
);

accountGroupSchema.index({ admin: 1, accountgroupcode: 1 }, { unique: true });
accountGroupSchema.index({ admin: 1, accountgroupname: 1,  }, { unique: true });

// Auto-generate accountgroupcode before saving
accountGroupSchema.pre('save', async function (next) {
  if (!this.accountgroupcode) {
    const AccountGroup = mongoose.model('AccountGroup');
    const lastGroup = await AccountGroup.findOne({
        admin: this.admin,
        accountgroupcode: { $regex: /^#ACCG\d{4}$/ }
      })
        .sort({ accountgroupcode: -1 })
        .exec();

    let nextNumber = 1;
    if (lastGroup?.accountgroupcode) {
      const lastNumber = parseInt(lastGroup.accountgroupcode.replace('#ACCG', ''), 10);
      if (!isNaN(lastNumber)) {
        nextNumber = lastNumber + 1;
      }
    }

    this.accountgroupcode = `#ACCG${nextNumber.toString().padStart(4, '0')}`;
  }
  next();
});

// Offline sync: one document per request id; only rows that carry one are indexed.
accountGroupSchema.add({ clientRequestId: { type: String } });
accountGroupSchema.index({ admin: 1, clientRequestId: 1 }, { unique: true, partialFilterExpression: { clientRequestId: { $type: "string" } } });

export const AccountGroup = mongoose.model('AccountGroup', accountGroupSchema);
