import { Room, IRoom } from "../../models/Room";

export const roomRepo = {
  async findById(id: string) {
    return Room.findById(id);
  },

  async findByInviteCode(code: string) {
    return Room.findOne({ inviteCode: code });
  },

  async findPublic(options: { tags?: string[]; limit?: number; skip?: number } = {}) {
    const query: any = { isPublic: true, archivedAt: null };
    if (options.tags?.length) query.tags = { $in: options.tags };
    return Room.find(query)
      .sort({ createdAt: -1 })
      .skip(options.skip || 0)
      .limit(options.limit || 20);
  },

  async findByUser(userId: string) {
    return Room.find({ memberIds: userId, archivedAt: null }).sort({ updatedAt: -1 });
  },

  async create(data: Partial<IRoom>) {
    return Room.create(data);
  },

  async update(id: string, data: Partial<IRoom>) {
    return Room.findByIdAndUpdate(id, { $set: data }, { new: true });
  },

  async addMember(roomId: string, userId: string) {
    return Room.findByIdAndUpdate(roomId, { $addToSet: { memberIds: userId } }, { new: true });
  },

  async removeMember(roomId: string, userId: string) {
    return Room.findByIdAndUpdate(roomId, { $pull: { memberIds: userId } }, { new: true });
  },

  async incrementInviteUses(roomId: string) {
    return Room.findByIdAndUpdate(roomId, { $inc: { inviteUseCount: 1 } }, { new: true });
  },

  async archive(roomId: string) {
    return Room.findByIdAndUpdate(roomId, { $set: { archivedAt: new Date() } }, { new: true });
  },

  async delete(id: string) {
    return Room.findByIdAndDelete(id);
  },
};
