import mongoose, { Schema, Document } from "mongoose";

export interface IReport extends Document {
  reporterId: string;
  messageId?: string;
  roomId?: string;
  reason: string;
  status: "pending" | "reviewed" | "dismissed";
  createdAt: Date;
  updatedAt: Date;
}

const reportSchema = new Schema<IReport>(
  {
    reporterId: { type: String, required: true },
    messageId: String,
    roomId: String,
    reason: { type: String, required: true },
    status: { type: String, enum: ["pending", "reviewed", "dismissed"], default: "pending" },
  },
  { timestamps: true }
);

export const Report = mongoose.model<IReport>("Report", reportSchema);
