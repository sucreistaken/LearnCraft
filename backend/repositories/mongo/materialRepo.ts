import { Material, IMaterial } from "../../models/Material";

export const materialRepo = {
  async findById(id: string) {
    return Material.findById(id);
  },

  async findByRoom(roomId: string) {
    return Material.findOne({ roomId }).sort({ createdAt: -1 });
  },

  async create(data: Partial<IMaterial>) {
    return Material.create(data);
  },

  async update(id: string, data: Partial<IMaterial>) {
    return Material.findByIdAndUpdate(id, { $set: data }, { new: true });
  },

  async deleteByRoom(roomId: string) {
    return Material.deleteMany({ roomId });
  },
};
