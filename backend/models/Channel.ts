import mongoose, { Schema, Document } from "mongoose";

export interface IChannel extends Document {
  roomId: string;
  name: string;
  type: "text" | "study-tool";
  toolType?: "quiz" | "flashcards" | "deep-dive" | "mind-map" | "sprint" | "notes";
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

const channelSchema = new Schema<IChannel>(
  {
    roomId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: ["text", "study-tool"], required: true },
    toolType: { type: String, enum: ["quiz", "flashcards", "deep-dive", "mind-map", "sprint", "notes"] },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const Channel = mongoose.model<IChannel>("Channel", channelSchema);
