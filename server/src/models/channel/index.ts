import mongoose, { Document, Schema } from "mongoose";

export interface IChannel extends Document {
  channelCode: string;
  channelName: string;
  admin: mongoose.Types.ObjectId;
  isDefault: boolean;
  status: boolean;
}

const ChannelSchema: Schema<IChannel> = new mongoose.Schema(
  {
    channelCode: { type: String },
    channelName: { type: String, required: true },
    admin: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true },
    isDefault: { type: Boolean, default: false },
    status: { type: Boolean, default: true },
  },
  { timestamps: true }
);

ChannelSchema.pre("save", async function (next) {
  if (this.isNew && !this.channelCode) {
    const last = await mongoose.model("Channel").findOne({
      admin: this.admin,
      channelCode: { $regex: /^#CH\d{3}$/ },
    }).sort({ channelCode: -1 });

    const lastNum = last?.channelCode
      ? parseInt(last.channelCode.replace("#CH", ""))
      : 0;

    this.channelCode = `#CH${String(lastNum + 1).padStart(3, "0")}`;
  }
  next();
});

export const Channel = mongoose.model<IChannel>("Channel", ChannelSchema);
