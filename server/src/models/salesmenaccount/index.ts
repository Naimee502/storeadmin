import mongoose from 'mongoose';

const salesmenAccountSchema = new mongoose.Schema(
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

    // Identity
    salesmancode: { type: String, unique: true },
    name: { type: String, required: true },
    mobile: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    profilepicture: { type: String },
    imageurl: { type: String },
    address: { type: String },

    // Accounting Related
    salary: { type: Number, default: 0 }, // optional fixed salary
    commission: { type: Number, default: 0 }, // percent or flat (based on your logic)
    target: { type: Number, default: 0 }, // monthly/quarterly/yearly
    ledgerid: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AccountLedger',
      required: true, // e.g., "Salesman Expense"
    },
    type: {
      type: String,
      enum: ['salesman'],
      default: 'salesman',
      required: true,
    },

    status: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Auto-generate salesmancode like #SAC0001
salesmenAccountSchema.pre('save', async function (next) {
  if (!this.salesmancode) {
    const SalesmenAccount = mongoose.model('SalesmenAccount');
    const last = await SalesmenAccount.findOne({
      salesmancode: { $regex: /^#SAC\d{4}$/ },
    })
      .sort({ salesmancode: -1 })
      .exec();

    let nextNumber = 1;
    if (last?.salesmancode) {
      const lastNumber = parseInt(last.salesmancode.replace('#SAC', ''), 10);
      if (!isNaN(lastNumber)) nextNumber = lastNumber + 1;
    }

    this.salesmancode = `#SAC${nextNumber.toString().padStart(4, '0')}`;
  }
  next();
});

export const SalesmenAccount = mongoose.model('SalesmenAccount', salesmenAccountSchema);
