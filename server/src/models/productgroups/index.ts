import mongoose from 'mongoose';

const productGroupSchema = new mongoose.Schema(
  {
    productgroupcode: { type: String, unique: true },
    productgroupname: { type: String, required: true, unique: true },
    status: Boolean,
    admin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      required: true
    },
  },
  { timestamps: true }
);

// Auto-generate productgroupcode before saving
productGroupSchema.pre('save', async function (next) {
  if (!this.productgroupcode) {
    const ProductGroup = mongoose.model('ProductGroup');
    const lastGroup = await ProductGroup.findOne({ productgroupcode: { $regex: /^#PRDG\d{4}$/ } })
      .sort({ productgroupcode: -1 })
      .exec();

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
