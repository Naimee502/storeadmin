import mongoose from 'mongoose';

const branchSchema = new mongoose.Schema({
  branchcode: { type: String, unique: true },
  branchname: String,
  mobile: { type: String, unique: true },  
  password: String,
  logo: String,
  location: String,
  address: String,
  city: String,
  pincode: String,
  phone: String,
  email: { type: String, unique: true },
  status: Boolean,
}, { timestamps: true });

branchSchema.pre('save', async function (next) {
  if (!this.branchcode) {
    const Branch = mongoose.model('Branch');
    const lastBranch = await Branch.findOne({ branchcode: { $regex: /^#BRC\d{4}$/ } })
      .sort({ branchcode: -1 })
      .exec();
    let nextNumber = 1;
    if (lastBranch && lastBranch.branchcode) {
      const lastNumber = parseInt(lastBranch.branchcode.replace('#BRC', ''), 10);
      if (!isNaN(lastNumber)) {
        nextNumber = lastNumber + 1;
      }
    }
    this.branchcode = `#BRC${nextNumber.toString().padStart(4, '0')}`;
  }
  next();
});

export const Branch = mongoose.model('Branch', branchSchema);
