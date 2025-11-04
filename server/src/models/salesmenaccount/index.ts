import mongoose from 'mongoose';

const salesmenAccountSchema = new mongoose.Schema(
  {
    admin: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true },
    branchid: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },

    salesmancode: { type: String, unique: true },
    name: { type: String, required: true },
    mobile: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    profilepicture: { type: String },
    imageurl: { type: String },
    address: { type: String },

    salary: { type: Number, default: 0 },
    commission: { type: Number, default: 0 },
    target: { type: Number, default: 0 },

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

    type: { type: String, enum: ['salesman'], default: 'salesman', required: true },
    status: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// ✅ Auto Code + Ledger
salesmenAccountSchema.pre("save", async function (next) {
  const SalesmenAccount = mongoose.model("SalesmenAccount");
  const AccountLedger = mongoose.model("AccountLedger");
  const AccountGroup = mongoose.model("AccountGroup");

  // ✅ Generate Salesman Code (#SAC0001)
  if (this.isNew && !this.salesmancode) {
    const last = await SalesmenAccount.findOne({
      salesmancode: { $regex: /^#SAC\d{4}$/ },
    }).sort({ salesmancode: -1 });

    const lastNum = last?.salesmancode ? parseInt(last.salesmancode.replace("#SAC","")) : 0;
    this.salesmancode = `#SAC${String(lastNum + 1).padStart(4,"0")}`;
  }

  // ✅ FIRST Auto Create "Salesman Account" group if missing
  let salesmanGroup = await AccountGroup.findOne({
    accountgroupname: "Salesman Account",
    admin: this.admin
  });

  if (!salesmanGroup) {
    salesmanGroup = await AccountGroup.create({
      admin: this.admin,
      accountgroupname: "Salesman Account",
      category: "expenses",
      status: true
    });
  }

  // ✅ If no accountgroupid passed, assign automatically
  if (!this.accountgroupid) {
    this.accountgroupid = salesmanGroup._id;
  }

  // ✅ Create Ledger for Salesman
  if (!this.ledgerid) {
    const ledger = await AccountLedger.create({
      admin: this.admin,
      accountid: this._id,
      accountgroupid: this.accountgroupid,
      ledgername: `${this.name} - ${this.salesmancode}`,
      openingbalance: 0,
      openingbalancetype: "debit",
      status: true,
    });

    this.ledgerid = ledger._id;
  }

  // ✅ Ensure Commission Expense Group exists
  let expenseGroup = await AccountGroup.findOne({
    accountgroupname: "Commission Expense",
    admin: this.admin
  });

  if (!expenseGroup) {
    expenseGroup = await AccountGroup.create({
      admin: this.admin,
      accountgroupname: "Commission Expense",
      category: "expenses",
      status: true
    });
  }

  // ✅ Ensure Commission Expense Ledger exists
  const commissionLedger = await AccountLedger.findOne({
    ledgername: "Salesman Commission Expense",
    admin: this.admin
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

  // ✅ Salary Payable group & ledger
  let salaryGroup = await AccountGroup.findOne({
    accountgroupname: "Salary Payable",
    admin: this.admin
  });

  if (!salaryGroup) {
    salaryGroup = await AccountGroup.create({
      admin: this.admin,
      accountgroupname: "Salary Payable",
      category: "liabilities",
      status: true
    });
  }

  const salaryLedger = await AccountLedger.findOne({
    ledgername: `Salary Payable - ${this.name}`,
    admin: this.admin
  });

  if (!salaryLedger) {
    await AccountLedger.create({
      admin: this.admin,
      accountid: this._id,
      accountgroupid: salaryGroup._id,
      ledgername: `Salary Payable - ${this.name}`,
      openingbalance: 0,
      openingbalancetype: "credit",
      status: true,
    });
  }

  next();
});

export const SalesmenAccount = mongoose.model('SalesmenAccount', salesmenAccountSchema);