import { Channel, IChannel } from "../../models/Channel";

export const channelRepo = {
  async findById(id: string) {
    return Channel.findById(id);
  },

  async findByRoom(roomId: string) {
    return Channel.find({ roomId }).sort({ order: 1 });
  },

  async create(data: Partial<IChannel>) {
    return Channel.create(data);
  },

  async update(id: string, data: Partial<IChannel>) {
    return Channel.findByIdAndUpdate(id, { $set: data }, { new: true });
  },

  async delete(id: string) {
    return Channel.findByIdAndDelete(id);
  },

  async deleteByRoom(roomId: string) {
    return Channel.deleteMany({ roomId });
  },
};
