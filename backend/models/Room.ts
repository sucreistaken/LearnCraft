import mongoose, { Schema, Document } from "mongoose";

export interface IRoom extends Document {
  name: string;
  topic: string;
  description?: string;
  iconColor: string;
  inviteCode: string;
  inviteExpiry?: Date;
  inviteMaxUses?: number;
  inviteUseCount: number;
  ownerId: string;
  isPublic: boolean;
  maxMembers: number;
  memberIds: string[];
  materialId?: string;
  tags: string[];
  archivedAt?: Date;
  allowExternalSharing: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const roomSchema = new Schema<IRoom>(
  {
    name: { type: String, required: true, trim: true },
    topic: { type: String, required: true, trim: true },
    description: String,
    iconColor: { type: String, default: "#5865F2" },
    inviteCode: { type: String, unique: true },
    inviteExpiry: Date,
    inviteMaxUses: Number,
    inviteUseCount: { type: Number, default: 0 },
    ownerId: { type: String, required: true },
    isPublic: { type: Boolean, default: true },
    maxMembers: { type: Number, default: 25 },
    memberIds: [String],
    materialId: String,
    tags: [String],
    archivedAt: Date,
    allowExternalSharing: { type: Boolean, default: false },
  },
  { timestamps: true }
);

roomSchema.index({ isPublic: 1, archivedAt: 1 });
roomSchema.index({ tags: 1 });
roomSchema.index({ inviteCode: 1 });

export const Room = mongoose.model<IRoom>("Room", roomSchema);
