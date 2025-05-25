import mongoose from 'mongoose';

const sizeSchema = new mongoose.Schema(
  {
    sizecode: { type: String, unique: true },
    sizename: { type: String, required: true, unique: true },
    status: Boolean,
  },
  { timestamps: true }
);

sizeSchema.pre('save', async function (next) {
  if (!this.sizecode) {
    const Size = mongoose.model('Size');
    const lastSize = await Size.findOne({ sizecode: { $regex: /^#SIZE\d{4}$/ } })
      .sort({ sizecode: -1 })
      .exec();

    let nextNumber = 1;
    if (lastSize?.sizecode) {
      const lastNumber = parseInt(lastSize.sizecode.replace('#SIZE', ''), 10);
      if (!isNaN(lastNumber)) {
        nextNumber = lastNumber + 1;
      }
    }

    this.sizecode = `#SIZE${nextNumber.toString().padStart(4, '0')}`;
  }
  next();
});

export const Size = mongoose.model('Size', sizeSchema);
