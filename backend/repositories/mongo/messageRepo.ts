import { Message, IMessage } from "../../models/Message";

export const messageRepo = {
  async findById(id: string) {
    return Message.findById(id);
  },

  async findByChannel(channelId: string, options: { limit?: number; before?: string } = {}) {
    const query: any = { channelId, deleted: false };
    if (options.before) {
      const beforeMsg = await Message.findById(options.before);
      if (beforeMsg) query.createdAt = { $lt: beforeMsg.createdAt };
    }
    return Message.find(query).sort({ createdAt: -1 }).limit(options.limit || 50);
  },

  async findThread(parentId: string) {
    return Message.find({ replyToId: parentId, deleted: false }).sort({ createdAt: 1 });
  },

  async create(data: Partial<IMessage>) {
    return Message.create(data);
  },

  async update(id: string, data: Partial<IMessage>) {
    return Message.findByIdAndUpdate(id, { $set: data }, { new: true });
  },

  async softDelete(id: string) {
    return Message.findByIdAndUpdate(id, { $set: { deleted: true, content: "[deleted]" } }, { new: true });
  },

  async deleteByChannel(channelId: string) {
    return Message.deleteMany({ channelId });
  },
};
