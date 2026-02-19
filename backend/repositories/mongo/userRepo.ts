import { User, IUser } from "../../models/User";

export const userRepo = {
  async findById(id: string) {
    return User.findById(id).select("-passwordHash");
  },

  async findByEmail(email: string) {
    return User.findOne({ email: email.toLowerCase().trim() });
  },

  async findByFriendCode(code: string) {
    return User.findOne({ friendCode: code }).select("-passwordHash");
  },

  async update(id: string, data: Partial<IUser>) {
    return User.findByIdAndUpdate(id, { $set: data }, { new: true }).select("-passwordHash");
  },

  async addFriend(userId: string, friendId: string) {
    await User.findByIdAndUpdate(userId, { $addToSet: { friendIds: friendId } });
    await User.findByIdAndUpdate(friendId, { $addToSet: { friendIds: userId } });
  },

  async removeFriend(userId: string, friendId: string) {
    await User.findByIdAndUpdate(userId, { $pull: { friendIds: friendId } });
    await User.findByIdAndUpdate(friendId, { $pull: { friendIds: userId } });
  },

  async addFriendRequest(userId: string, fromId: string) {
    await User.findByIdAndUpdate(userId, {
      $push: { friendRequests: { from: fromId, createdAt: new Date() } },
    });
  },

  async removeFriendRequest(userId: string, fromId: string) {
    await User.findByIdAndUpdate(userId, {
      $pull: { friendRequests: { from: fromId } },
    });
  },

  async setStatus(userId: string, status: string) {
    return User.findByIdAndUpdate(userId, { $set: { status } }, { new: true }).select("-passwordHash");
  },

  async addRoom(userId: string, roomId: string) {
    await User.findByIdAndUpdate(userId, { $addToSet: { roomIds: roomId } });
  },

  async removeRoom(userId: string, roomId: string) {
    await User.findByIdAndUpdate(userId, { $pull: { roomIds: roomId } });
  },

  async muteRoom(userId: string, roomId: string) {
    await User.findByIdAndUpdate(userId, { $addToSet: { mutedRoomIds: roomId } });
  },

  async unmuteRoom(userId: string, roomId: string) {
    await User.findByIdAndUpdate(userId, { $pull: { mutedRoomIds: roomId } });
  },

  async delete(id: string) {
    return User.findByIdAndDelete(id);
  },
};
