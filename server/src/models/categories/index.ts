import mongoose from 'mongoose';

const categorySchema = new mongoose.Schema(
  {
    categorycode: { type: String },
    categoryname: { type: String, required: true },
    image: { type: String, default: "" },
    status: Boolean,
    admin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      required: true
    },
  },
  { timestamps: true }
);

categorySchema.index({ admin: 1, categorycode: 1 }, { unique: true });
categorySchema.index({ admin: 1, categoryname: 1 }, { unique: true });

categorySchema.pre('save', async function (next) {
  if (!this.categorycode) {
    const Category = mongoose.model('Category');
    const lastCategory = await Category.findOne({
      admin: this.admin,                 // only for this admin
      categorycode: { $regex: /^#CAT\d{4}$/ }
    }).sort({ categorycode: -1 }).exec();
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
