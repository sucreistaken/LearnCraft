import mongoose, { Schema, Document } from "mongoose";

export interface IMaterial extends Document {
  roomId: string;
  uploadedBy: string;
  pdfPath?: string;
  audioPath?: string;
  transcript?: string;
  slideText?: string;
  createdAt: Date;
  updatedAt: Date;
}

const materialSchema = new Schema<IMaterial>(
  {
    roomId: { type: String, required: true, index: true },
    uploadedBy: { type: String, required: true },
    pdfPath: String,
    audioPath: String,
    transcript: String,
    slideText: String,
  },
  { timestamps: true }
);

export const Material = mongoose.model<IMaterial>("Material", materialSchema);
