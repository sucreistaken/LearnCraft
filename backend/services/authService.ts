import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { User, IUser } from "../models/User";
import { env } from "../config/env";

function generateFriendCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function signToken(userId: string): { token: string; expiresIn: string } {
  const token = jwt.sign({ userId }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN as any });
  return { token, expiresIn: env.JWT_EXPIRES_IN };
}

export const authService = {
  async register(email: string, password: string, nickname: string) {
    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) throw Object.assign(new Error("Email already registered"), { status: 409 });

    if (password.length < 6) throw Object.assign(new Error("Password must be at least 6 characters"), { status: 400 });

    const passwordHash = await bcrypt.hash(password, 12);
    const friendCode = generateFriendCode();

    const user = await User.create({
      email: email.toLowerCase().trim(),
      passwordHash,
      profile: { nickname: nickname.trim(), avatar: "avatar-1" },
      friendCode,
    });

    const { token, expiresIn } = signToken(user._id.toString());
    return {
      user: { id: user._id.toString(), email: user.email, profile: user.profile, friendCode: user.friendCode },
      token,
      expiresIn,
    };
  },

  async login(email: string, password: string) {
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) throw Object.assign(new Error("Invalid email or password"), { status: 401 });

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw Object.assign(new Error("Invalid email or password"), { status: 401 });

    const { token, expiresIn } = signToken(user._id.toString());
    return {
      user: { id: user._id.toString(), email: user.email, profile: user.profile, friendCode: user.friendCode, settings: user.settings },
      token,
      expiresIn,
    };
  },

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await User.findById(userId);
    if (!user) throw Object.assign(new Error("User not found"), { status: 404 });

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) throw Object.assign(new Error("Current password is incorrect"), { status: 401 });

    if (newPassword.length < 6) throw Object.assign(new Error("New password must be at least 6 characters"), { status: 400 });

    user.passwordHash = await bcrypt.hash(newPassword, 12);
    await user.save();
    return { ok: true };
  },

  async deleteAccount(userId: string, password: string) {
    const user = await User.findById(userId);
    if (!user) throw Object.assign(new Error("User not found"), { status: 404 });

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw Object.assign(new Error("Password is incorrect"), { status: 401 });

    await User.findByIdAndDelete(userId);
    return { ok: true };
  },

  verifyToken(token: string): { userId: string } {
    try {
      const decoded = jwt.verify(token, env.JWT_SECRET) as { userId: string };
      return decoded;
    } catch {
      throw Object.assign(new Error("Invalid or expired token"), { status: 401 });
    }
  },

  async getUser(userId: string) {
    const user = await User.findById(userId).select("-passwordHash");
    if (!user) throw Object.assign(new Error("User not found"), { status: 404 });
    return user;
  },
};
