import mongoose from 'mongoose';

const unitSchema = new mongoose.Schema(
  {
    unitcode: { type: String, unique: true },
    unitname: { type: String, required: true, unique: true },
    status: Boolean,

    admin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      required: true
    },
  },
  { timestamps: true }
);

unitSchema.pre('save', async function (next) {
  if (!this.unitcode) {
    const Unit = mongoose.model('Unit');
    const lastUnit = await Unit.findOne({ unitcode: { $regex: /^#UNIT\d{4}$/ } })
      .sort({ unitcode: -1 })
      .exec();

    let nextNumber = 1;
    if (lastUnit?.unitcode) {
      const lastNumber = parseInt(lastUnit.unitcode.replace('#UNIT', ''), 10);
      if (!isNaN(lastNumber)) {
        nextNumber = lastNumber + 1;
      }
    }

    this.unitcode = `#UNIT${nextNumber.toString().padStart(4, '0')}`;
  }
  next();
});

export const Unit = mongoose.model('Unit', unitSchema);
