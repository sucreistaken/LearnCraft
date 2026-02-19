import { ToolData, IToolData } from "../../models/ToolData";

export const toolDataRepo = {
  async findByChannel(channelId: string) {
    return ToolData.findOne({ channelId });
  },

  async findByChannelAndType(channelId: string, toolType: string) {
    return ToolData.findOne({ channelId, toolType });
  },

  async upsert(channelId: string, toolType: string, data: any) {
    return ToolData.findOneAndUpdate(
      { channelId, toolType },
      { $set: { data }, $inc: { version: 1 } },
      { upsert: true, new: true }
    );
  },

  async setLock(channelId: string, toolType: string, locked: boolean, lockedBy?: string) {
    return ToolData.findOneAndUpdate(
      { channelId, toolType },
      { $set: { locked, lockedBy: locked ? lockedBy : undefined } },
      { new: true }
    );
  },

  async deleteByChannel(channelId: string) {
    return ToolData.deleteMany({ channelId });
  },
};
