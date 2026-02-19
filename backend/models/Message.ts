import mongoose, { Schema, Document } from "mongoose";

export interface IMessage extends Document {
  channelId: string;
  roomId: string;
  authorId: string;
  content: string;
  type: "text" | "system" | "file";
  fileUrl?: string;
  fileName?: string;
  fileType?: string;
  replyToId?: string;
  mentions: string[];
  edited: boolean;
  deleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const messageSchema = new Schema<IMessage>(
  {
    channelId: { type: String, required: true, index: true },
    roomId: { type: String, required: true },
    authorId: { type: String, required: true },
    content: { type: String, required: true },
    type: { type: String, enum: ["text", "system", "file"], default: "text" },
    fileUrl: String,
    fileName: String,
    fileType: String,
    replyToId: String,
    mentions: [String],
    edited: { type: Boolean, default: false },
    deleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

messageSchema.index({ channelId: 1, createdAt: -1 });

export const Message = mongoose.model<IMessage>("Message", messageSchema);
