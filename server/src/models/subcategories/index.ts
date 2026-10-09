import mongoose from 'mongoose';

const subCategorySchema = new mongoose.Schema(
  {
    subcategorycode: { type: String },
    subcategoryname: { type: String, required: true },
    // Optional, same as Category.image — an /uploads url or "".
    image: { type: String, default: "" },
    status: { type: Boolean, default: true },
    // Position inside its parent category on the app's catalogue browse
    // (Category → Sub-category). Lower first; set from the admin "Rearrange"
    // screen. A new sub-category goes to the end of its category. Rows saved
    // before this existed sort first, by createdAt — their old order.
    sortorder: { type: Number },

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
subCategorySchema.index({ admin: 1, category: 1, sortorder: 1 });

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
  if (this.isNew && (this.sortorder === undefined || this.sortorder === null)) {
    const SubCategory = mongoose.model('SubCategory');
    const last = await SubCategory.findOne({ admin: this.admin, category: this.category, sortorder: { $ne: null } })
      .sort({ sortorder: -1 })
      .select('sortorder')
      .lean<{ sortorder?: number }>()
      .exec();
    this.sortorder = (last?.sortorder ?? 0) + 1;
  }
  next();
});

export const SubCategory = mongoose.model('SubCategory', subCategorySchema);
