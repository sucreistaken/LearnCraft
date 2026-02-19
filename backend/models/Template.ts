import mongoose, { Schema, Document } from "mongoose";

export interface ITemplate extends Document {
  userId: string;
  name: string;
  config: {
    channels: { name: string; type: "text" | "study-tool"; toolType?: string }[];
    isPublic: boolean;
    maxMembers: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

const templateSchema = new Schema<ITemplate>(
  {
    userId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    config: {
      channels: [{
        name: { type: String, required: true },
        type: { type: String, enum: ["text", "study-tool"], required: true },
        toolType: String,
      }],
      isPublic: { type: Boolean, default: true },
      maxMembers: { type: Number, default: 25 },
    },
  },
  { timestamps: true }
);

export const Template = mongoose.model<ITemplate>("Template", templateSchema);
