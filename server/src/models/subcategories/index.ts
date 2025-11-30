import mongoose from 'mongoose';

const subCategorySchema = new mongoose.Schema(
  {
    subcategorycode: { type: String },
    subcategoryname: { type: String, required: true },
    status: { type: Boolean, default: true },

    // Link to parent Category
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: true
    },

    // Link to Admin
    admin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      required: true
    },
  },
  { timestamps: true }
);

subCategorySchema.index({ admin: 1, subcategorycode: 1 }, { unique: true });
subCategorySchema.index({ admin: 1, subcategoryname: 1 }, { unique: true });

// Auto-generate subcategory code
subCategorySchema.pre('save', async function (next) {
  if (!this.subcategorycode) {
    const SubCategory = mongoose.model('SubCategory');

    const lastSubCategory = await SubCategory.findOne({
        admin: this.admin,
        subcategorycode: { $regex: /^#SUBC\d{4}$/ }
      })
      .sort({ subcategorycode: -1 })
      .exec();

    let nextNumber = 1;
    if (lastSubCategory && lastSubCategory.subcategorycode) {
      const lastNumber = parseInt(lastSubCategory.subcategorycode.replace('#SUBC', ''), 10);
      if (!isNaN(lastNumber)) {
        nextNumber = lastNumber + 1;
      }
    }

    this.subcategorycode = `#SUBC${nextNumber.toString().padStart(4, '0')}`;
  }
  next();
});

export const SubCategory = mongoose.model('SubCategory', subCategorySchema);
