import mongoose from 'mongoose';

const salesmenAccountSchema = new mongoose.Schema(
  {
    branchid: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
    salesmancode: { type: String, unique: true },
    name: { type: String, required: true },
    mobile: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    profilepicture: { type: String },
    imageurl: { type: String },
    address: { type: String },
    commission: { type: String },
    target: { type: String },
    status: { type: Boolean, default: true },
    admin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      required: true,
    },
  },
  { timestamps: true }
);

// Auto-generate salesmancode before saving
salesmenAccountSchema.pre('save', async function (next) {
  if (!this.salesmancode) {
    const SalesmenAccount = mongoose.model('SalesmenAccount');
    const lastSalesman = await SalesmenAccount.findOne({
      salesmancode: { $regex: /^#SAC\d{4}$/ },
    })
      .sort({ salesmancode: -1 })
      .exec();

    let nextNumber = 1;
    if (lastSalesman?.salesmancode) {
      const lastNumber = parseInt(lastSalesman.salesmancode.replace('#SAC', ''), 10);
      if (!isNaN(lastNumber)) {
        nextNumber = lastNumber + 1;
      }
    }

    this.salesmancode = `#SAC${nextNumber.toString().padStart(4, '0')}`;
  }
  next();
});

export const SalesmenAccount = mongoose.model('SalesmenAccount', salesmenAccountSchema);
