import mongoose from 'mongoose';

const productGroupSchema = new mongoose.Schema(
  {
    productgroupcode: { type: String },
    productgroupname: { type: String, required: true },
    status: Boolean,
    admin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      required: true
    },
  },
  { timestamps: true }
);

productGroupSchema.index({ admin: 1, productgroupcode: 1 }, { unique: true });
productGroupSchema.index({ admin: 1, productgroupname: 1 }, { unique: true });

// Auto-generate productgroupcode before saving
productGroupSchema.pre('save', async function (next) {
  if (!this.productgroupcode) {
    const ProductGroup = mongoose.model('ProductGroup');
    const lastGroup = await ProductGroup.findOne({
      admin: this.admin,                        
      productgroupcode: { $regex: /^#PRDG\d{4}$/ }
    }).sort({ productgroupcode: -1 }).exec();

    let nextNumber = 1;
    if (lastGroup?.productgroupcode) {
      const lastNumber = parseInt(lastGroup.productgroupcode.replace('#PRDG', ''), 10);
      if (!isNaN(lastNumber)) {
        nextNumber = lastNumber + 1;
      }
    }

    this.productgroupcode = `#PRDG${nextNumber.toString().padStart(4, '0')}`;
  }
  next();
});

export const ProductGroup = mongoose.model('ProductGroup', productGroupSchema);
