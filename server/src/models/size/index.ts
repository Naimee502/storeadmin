import mongoose from 'mongoose';

const sizeSchema = new mongoose.Schema(
  {
    sizecode: { type: String },
    sizename: { type: String, required: true },
    status: Boolean,

    admin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      required: true
    },
  },
  { timestamps: true }
);

sizeSchema.index({ admin: 1, sizecode: 1 }, { unique: true });
sizeSchema.index({ admin: 1, sizename: 1 }, { unique: true });

sizeSchema.pre('save', async function (next) {
  if (!this.sizecode) {
    const Size = mongoose.model('Size');
    const lastSize = await Size.findOne({
        admin: this.admin,
        sizecode: { $regex: /^#SIZE\d{4}$/ }
      }).sort({ sizecode: -1 }).exec();

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


// Offline sync: one document per request id; only rows that carry one are indexed.
sizeSchema.add({ clientRequestId: { type: String } });
sizeSchema.index({ admin: 1, clientRequestId: 1 }, { unique: true, partialFilterExpression: { clientRequestId: { $type: "string" } } });
export const Size = mongoose.model('Size', sizeSchema);
