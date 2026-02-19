import mongoose, { Schema, Document } from "mongoose";

export interface IToolData extends Document {
  channelId: string;
  toolType: string;
  data: any;
  locked: boolean;
  lockedBy?: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

const toolDataSchema = new Schema<IToolData>(
  {
    channelId: { type: String, required: true, index: true },
    toolType: { type: String, required: true },
    data: { type: Schema.Types.Mixed, default: {} },
    locked: { type: Boolean, default: false },
    lockedBy: String,
    version: { type: Number, default: 1 },
  },
  { timestamps: true }
);

toolDataSchema.index({ channelId: 1, toolType: 1 }, { unique: true });

export const ToolData = mongoose.model<IToolData>("ToolData", toolDataSchema);
