import mongoose from 'mongoose';
import { ProductBranchStock } from '../productbranchstock';
import { Product } from '../products';

const branchSchema = new mongoose.Schema({
  branchcode: { type: String, unique: true },
  branchname: String,
  mobile: { type: String, unique: true },  
  password: String,
  logo: String,
  imageurl: { type: String },
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

branchSchema.post('save', async function (doc) {
  const branchId = doc._id;

  const allProducts = await Product.find({});

  const branchProducts = allProducts.map(product => {
    const isCurrentBranch = false;

    return {
      branchid: branchId,
      productid: product._id,
      openingstock: isCurrentBranch ? product.openingstock : 0,
      openingstockamount: isCurrentBranch ? product.openingstockamount : 0,
      currentstock: isCurrentBranch ? product.currentstock : 0,
      currentstockamount: isCurrentBranch ? product.currentstockamount : 0,
      minimumstock: product.minimumstock ?? 0,
    };
  });

  if (branchProducts.length > 0) {
    await ProductBranchStock.insertMany(branchProducts); // ✅ correct model
  }
});

export const Branch = mongoose.model('Branch', branchSchema);
