import mongoose, { Schema, Document } from "mongoose";

export interface IUser extends Document {
  email: string;
  passwordHash: string;
  profile: {
    nickname: string;
    avatar: string;
    department?: string;
    bio?: string;
  };
  settings: {
    theme: "dark" | "light";
    notifications: boolean;
    sound: boolean;
  };
  friendIds: string[];
  friendRequests: { from: string; createdAt: Date }[];
  friendCode: string;
  roomIds: string[];
  dmChannelIds: string[];
  status: "online" | "idle" | "dnd" | "offline";
  mutedRoomIds: string[];
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    profile: {
      nickname: { type: String, required: true, trim: true },
      avatar: { type: String, default: "avatar-1" },
      department: String,
      bio: String,
    },
    settings: {
      theme: { type: String, enum: ["dark", "light"], default: "dark" },
      notifications: { type: Boolean, default: true },
      sound: { type: Boolean, default: true },
    },
    friendIds: [String],
    friendRequests: [{ from: String, createdAt: { type: Date, default: Date.now } }],
    friendCode: { type: String, unique: true },
    roomIds: [String],
    dmChannelIds: [String],
    status: { type: String, enum: ["online", "idle", "dnd", "offline"], default: "offline" },
    mutedRoomIds: [String],
  },
  { timestamps: true }
);

export const User = mongoose.model<IUser>("User", userSchema);
