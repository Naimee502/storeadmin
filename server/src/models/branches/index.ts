import mongoose from 'mongoose';
import { ProductBranchStock } from '../productbranchstock';
import { ProductService } from '../products';
import { convertToBaseUnit } from '../../utils/unitconversation';

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

  admin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      required: true
  },  
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

  const allProducts = await ProductService.find({ isservice: false });
  const branchProducts: any[] = [];

  for (const product of allProducts) {
    if (Array.isArray(product.productvariants)) {
      for (const variant of product.productvariants) {
        const openingStock = convertToBaseUnit(0, variant.purchaseunitid, variant);
        branchProducts.push({
          admin: product.adminid,
          branchid: branchId,
          productid: product._id,
          variantid: variant._id || new mongoose.Types.ObjectId(),
          openingstock: openingStock,
          openingstockamount: openingStock * (variant.purchaserate || 0),
          currentstock: openingStock,
          currentstockamount: openingStock * (variant.purchaserate || 0),
          closingstock: openingStock,
          closingstockamount: openingStock * (variant.purchaserate || 0),
          minimumstock: variant.reorderlevel ?? 0,
        });
      }
    }
  }

  if (branchProducts.length > 0) {
    await ProductBranchStock.insertMany(branchProducts);
  }
});


export const Branch = mongoose.model('Branch', branchSchema);
