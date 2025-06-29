import mongoose from 'mongoose';

const modelSchema = new mongoose.Schema(
  {
    modelcode: { type: String, unique: true },
    modelname: { type: String, required: true, unique: true },
    status: Boolean,

    admin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      required: true
    },
  },
  { timestamps: true }
);

// Auto-generate modelcode before saving
modelSchema.pre('save', async function (next) {
  if (!this.modelcode) {
    const Model = mongoose.model('Model');
    const lastModel = await Model.findOne({ modelcode: { $regex: /^#MODL\d{4}$/ } })
      .sort({ modelcode: -1 })
      .exec();

    let nextNumber = 1;
    if (lastModel?.modelcode) {
      const lastNumber = parseInt(lastModel.modelcode.replace('#MODL', ''), 10);
      if (!isNaN(lastNumber)) {
        nextNumber = lastNumber + 1;
      }
    }

    this.modelcode = `#MODL${nextNumber.toString().padStart(4, '0')}`;
  }
  next();
});

export const Model = mongoose.model('Model', modelSchema);
