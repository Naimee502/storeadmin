import mongoose from 'mongoose';

const categorySchema = new mongoose.Schema(
  {
    categorycode: { type: String, unique: true },
    categoryname: { type: String, required: true, unique: true },
    status: Boolean,

    admin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      required: true
    },
  },
  { timestamps: true }
);

categorySchema.pre('save', async function (next) {
  if (!this.categorycode) {
    const Category = mongoose.model('Category');
    const lastCategory = await Category.findOne({ categorycode: { $regex: /^#CAT\d{4}$/ } })
      .sort({ categorycode: -1 })
      .exec();
    let nextNumber = 1;
    if (lastCategory && lastCategory.categorycode) {
      const lastNumber = parseInt(lastCategory.categorycode.replace('#CAT', ''), 10);
      if (!isNaN(lastNumber)) {
        nextNumber = lastNumber + 1;
      }
    }
    this.categorycode = `#CAT${nextNumber.toString().padStart(4, '0')}`;
  }
  next();
});

export const Category = mongoose.model('Category', categorySchema);
