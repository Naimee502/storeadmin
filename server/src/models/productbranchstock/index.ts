import mongoose from 'mongoose';

const productBranchStockSchema = new mongoose.Schema({
  adminid: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
  },
  productid: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ProductService', // or 'Product' if your model name is Product
    required: true
  },
  variantid: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ProductServiceVariant', // add your variant model name here
    required: false // optional, since some products may not have variants
  },
  branchid: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Branch',
    required: true
  },
  openingstock: {
    type: Number,
    required: true
  },
  openingstockamount: {
    type: Number,
    default: 0
  },
  currentstock: {
    type: Number,
    default: 0
  },
  currentstockamount: {
    type: Number,
    default: 0
  },
  closingstock: {
    type: Number,
    default: 0
  },
  closingstockamount: {
    type: Number,
    default: 0
  },
  minimumstock: {
    type: Number,
    default: 0
  }, 
  reorderlevel: { 
    type: Number, 
    default: 0 
  }, 
  averagecost: 
  { 
    type: Number, 
    default: 0 
  }
}, { timestamps: true });

// Ensure uniqueness branch + product + variant
productBranchStockSchema.index(
  { productid: 1, variantid: 1, branchid: 1 },
  { unique: true }
);

export const ProductBranchStock = mongoose.model(
  'ProductBranchStock',
  productBranchStockSchema
);
