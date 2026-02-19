import { Notification, INotification } from "../../models/Notification";

export const notificationRepo = {
  async findByUser(userId: string, options: { limit?: number; unreadOnly?: boolean } = {}) {
    const query: any = { userId };
    if (options.unreadOnly) query.read = false;
    return Notification.find(query).sort({ createdAt: -1 }).limit(options.limit || 50);
  },

  async countUnread(userId: string) {
    return Notification.countDocuments({ userId, read: false });
  },

  async create(data: Partial<INotification>) {
    return Notification.create(data);
  },

  async markRead(id: string) {
    return Notification.findByIdAndUpdate(id, { $set: { read: true } }, { new: true });
  },

  async markAllRead(userId: string) {
    return Notification.updateMany({ userId, read: false }, { $set: { read: true } });
  },

  async delete(id: string) {
    return Notification.findByIdAndDelete(id);
  },
};
