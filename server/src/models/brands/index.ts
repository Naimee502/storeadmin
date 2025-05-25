import mongoose from 'mongoose';

const brandSchema = new mongoose.Schema(
  {
    brandcode: { type: String, unique: true },
    brandname: { type: String, required: true, unique: true },
    status: Boolean,
  },
  { timestamps: true }
);

brandSchema.pre('save', async function (next) {
  if (!this.brandcode) {
    const Brand = mongoose.model('Brand');
    const lastBrand = await Brand.findOne({ brandcode: { $regex: /^#BRND\d{4}$/ } })
      .sort({ brandcode: -1 })
      .exec();

    let nextNumber = 1;
    if (lastBrand?.brandcode) {
      const lastNumber = parseInt(lastBrand.brandcode.replace('#BRND', ''), 10);
      if (!isNaN(lastNumber)) {
        nextNumber = lastNumber + 1;
      }
    }

    this.brandcode = `#BRND${nextNumber.toString().padStart(4, '0')}`;
  }
  next();
});

export const Brand = mongoose.model('Brand', brandSchema);
