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

// Helper to safely get purchase rate
const getPurchaseRate = (variant: any) => {
  if (variant?.pricing?.length > 0 && variant.pricing[0].unitprices?.length > 0) {
    return variant.pricing[0].unitprices[0].purchaserate || 0;
  }
  return 0;
};

// Hook to auto-create branch product stocks
branchSchema.post("save", async function (doc) {
  try {
    const branchId = doc._id;

    // Fetch all products (excluding services)
    const allProducts = await ProductService.find({ isservice: false }).lean();
    const branchProducts: any[] = [];

    for (const product of allProducts) {
      if (Array.isArray(product.productvariants) && product.productvariants.length > 0) {
        for (const variant of product.productvariants) {
          const purchaseRate = getPurchaseRate(variant);
          const openingStock = 0; // You are initializing all new branches with zero stock

          branchProducts.push({
            admin: product.adminid,
            branchid: branchId,
            productid: product._id,
            variantid: variant._id, // Each subdoc already has an ObjectId
            openingstock: openingStock,
            openingstockamount: openingStock * purchaseRate,
            currentstock: openingStock,
            currentstockamount: openingStock * purchaseRate,
            closingstock: openingStock,
            closingstockamount: openingStock * purchaseRate,
            minimumstock: variant.reorderlevel ?? 0,
          });
        }
      }
    }

    if (branchProducts.length > 0) {
      await ProductBranchStock.insertMany(branchProducts);
      console.log(`✅ Initialized ${branchProducts.length} product stocks for branch ${branchId}`);
    }
  } catch (error) {
    console.error("❌ Error initializing branch product stocks:", error);
  }
});


export const Branch = mongoose.model('Branch', branchSchema);
