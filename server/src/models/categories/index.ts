import mongoose from 'mongoose';

const categorySchema = new mongoose.Schema(
  {
    categorycode: { type: String },
    categoryname: { type: String, required: true },
    image: { type: String, default: "" },
    status: Boolean,
    // Position on the storefront (app Home/Shop strip, website nav and grids).
    // Lower comes first. Set from the admin "Rearrange" screen; a new category
    // goes to the end. Older rows without it sort first, by createdAt, which
    // is the order they were already showing in.
    sortorder: { type: Number },
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
categorySchema.index({ admin: 1, sortorder: 1 });

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
  if (this.isNew && (this.sortorder === undefined || this.sortorder === null)) {
    const Category = mongoose.model('Category');
    const last = await Category.findOne({ admin: this.admin, sortorder: { $ne: null } })
      .sort({ sortorder: -1 })
      .select('sortorder')
      .lean<{ sortorder?: number }>()
      .exec();
    this.sortorder = (last?.sortorder ?? 0) + 1;
  }
  next();
});

export const Category = mongoose.model('Category', categorySchema);
