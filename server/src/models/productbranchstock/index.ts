import mongoose from 'mongoose';

const productBranchStockSchema = new mongoose.Schema({
    productid: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true
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
    minimumstock: {
        type: Number,
        default: 0
    }
}, { timestamps: true });

// Optional: prevent duplicate entries for the same product + branch
productBranchStockSchema.index({ productid: 1, branchid: 1 }, { unique: true });

export const ProductBranchStock = mongoose.model('ProductBranchStock', productBranchStockSchema);
