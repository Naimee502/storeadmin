import mongoose, { UpdateQuery } from 'mongoose';

const salesmenAccountSchema = new mongoose.Schema(
  {
    admin: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true },
    branchid: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },

    salesmancode: { type: String },
    name: { type: String, required: true },
    mobile: { type: String, required: true },
    email: { type: String, required: true },
    password: { type: String, required: true },
    profilepicture: { type: String },
    imageurl: { type: String },
    address: { type: String },

    salary: { type: Number, default: 0 },
    commission: { type: Number, default: 0 },
    target: { type: Number, default: 0 },

    accountgroupid: { type: mongoose.Schema.Types.ObjectId, ref: 'AccountGroup', required: true },
    ledgerid: { type: mongoose.Schema.Types.ObjectId, ref: 'AccountLedger', default: null },

    type: { type: String, enum: ['salesman'], default: 'salesman', required: true },
    status: { type: Boolean, default: true },
  },
  { timestamps: true }
);

salesmenAccountSchema.index({ admin: 1, branchid: 1, salesmancode: 1 }, { unique: true });
salesmenAccountSchema.index({ admin: 1, mobile: 1 }, { unique: true });
salesmenAccountSchema.index({ admin: 1, email: 1 }, { unique: true });

// ✅ Auto Code + Ledger + Commission & Salary Ledgers
salesmenAccountSchema.pre("save", async function (next) {
  const SalesmenAccount = mongoose.model("SalesmenAccount");
  const AccountLedger = mongoose.model("AccountLedger");
  const AccountGroup = mongoose.model("AccountGroup");

  try {
    // 1️⃣ Check mobile/email uniqueness BEFORE creating ledger
    const exists = await SalesmenAccount.findOne({
      admin: this.admin,
      $or: [{ mobile: this.mobile }, { email: this.email }],
      _id: { $ne: this._id }
    });
    if (exists) throw new Error(`Salesman with this mobile or email already exists: ${exists.name} (${exists.mobile}, ${exists.email})`);

    // 2️⃣ Generate Salesman Code (#SAC0001)
    if (this.isNew && !this.salesmancode) {
      const last = await SalesmenAccount.findOne({
        admin: this.admin,
        branchid: this.branchid,
        salesmancode: { $regex: /^#SAC\d{4}$/ },
      }).sort({ salesmancode: -1 });
      const lastNum = last?.salesmancode ? parseInt(last.salesmancode.replace("#SAC","")) : 0;
      this.salesmancode = `#SAC${String(lastNum + 1).padStart(4,"0")}`;
    }

    // 3️⃣ Ensure Salesman Account group exists
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
    if (!this.accountgroupid) this.accountgroupid = salesmanGroup._id;

    // 4️⃣ Create Main Ledger for Salesman if new
    if (this.isNew && !this.ledgerid) {
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

    // 5️⃣ Update main ledger name if salesman name changed
    if (!this.isNew && this.isModified('name') && this.ledgerid) {
      await AccountLedger.updateOne(
        { _id: this.ledgerid },
        { $set: { ledgername: `${this.name} - ${this.salesmancode}` } }
      );

      // ✅ Also update salary ledger name
      await AccountLedger.updateMany(
        { accountid: this._id, ledgername: new RegExp(`^Salary Payable -`) },
        { $set: { ledgername: `Salary Payable - ${this.name}` } }
      );
    }

    // 6️⃣ Ensure Commission Expense Ledger exists
    let expenseGroup = await AccountGroup.findOne({ accountgroupname: "Commission Expense", admin: this.admin });
    if (!expenseGroup) {
      expenseGroup = await AccountGroup.create({ admin: this.admin, accountgroupname: "Commission Expense", category: "expenses", status: true });
    }
    let commissionLedger = await AccountLedger.findOne({ ledgername: "Salesman Commission Expense", admin: this.admin });
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

    // // 7️⃣ Ensure Salary Payable Ledger exists
    // let salaryGroup = await AccountGroup.findOne({ accountgroupname: "Salary Payable", admin: this.admin });
    // if (!salaryGroup) {
    //   salaryGroup = await AccountGroup.create({ admin: this.admin, accountgroupname: "Salary Payable", category: "liabilities", status: true });
    // }
    // const salaryLedger = await AccountLedger.findOne({ ledgername: `Salary Payable - ${this.name}`, admin: this.admin });
    // if (!salaryLedger) {
    //   await AccountLedger.create({
    //     admin: this.admin,
    //     accountid: this._id,
    //     accountgroupid: salaryGroup._id,
    //     ledgername: `Salary Payable - ${this.name}`,
    //     openingbalance: 0,
    //     openingbalancetype: "credit",
    //     status: true
    //   });
    // }

    next();
  } catch (err:any) {
    next(err);
  }
});

salesmenAccountSchema.pre('findOneAndUpdate', async function (next) {
  const update = this.getUpdate() as mongoose.UpdateQuery<any>;
  if (!update || !update.name) return next();

  const docToUpdate = await this.model.findOne(this.getQuery());
  if (!docToUpdate) return next();

  const AccountLedger = mongoose.model("AccountLedger");

  // 1️⃣ Update main salesman ledger
  if (docToUpdate.ledgerid) {
    await AccountLedger.updateOne(
      { _id: docToUpdate.ledgerid },
      { $set: { ledgername: `${update.name} - ${docToUpdate.salesmancode}` } }
    );
  }

  // // 2️⃣ Update all Salary Payable ledgers for this admin starting with 'Salary Payable -'
  // await AccountLedger.updateMany(
  //   {
  //     admin: docToUpdate.admin,
  //     ledgername: { $regex: `^Salary Payable -.*` },
  //   },
  //   { $set: { ledgername: `Salary Payable - ${update.name}` } }
  // );

  next();
});


export const SalesmenAccount = mongoose.model('SalesmenAccount', salesmenAccountSchema);
