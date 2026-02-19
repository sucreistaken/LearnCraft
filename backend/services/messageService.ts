import { messageRepo, ChannelMessage, MessageEmbed } from "../repositories/messageRepo";
import { channelService } from "./channelService";
import { eventBus } from "../events/eventBus";
import { badRequest, notFound, forbidden } from "../middleware/errorHandler";

function generateId(): string {
  return `msg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function parseMentions(content: string): string[] {
  const matches = content.match(/@(\S+)/g);
  if (!matches) return [];
  return [...new Set(matches.map((m) => m.slice(1)))];
}

export const messageService = {
  async send(
    channelId: string,
    serverId: string,
    authorId: string,
    content: string,
    type: ChannelMessage["type"] = "text",
    embeds: MessageEmbed[] = [],
    threadId?: string
  ): Promise<ChannelMessage> {
    if (type === "text" && (!content || content.trim().length === 0)) {
      throw badRequest("Message content cannot be empty");
    }

    const message: ChannelMessage = {
      id: generateId(),
      channelId,
      authorId,
      content: content.trim(),
      type,
      embeds,
      mentions: parseMentions(content),
      reactions: [],
      threadId,
      replyCount: 0,
      pinned: false,
      edited: false,
      deleted: false,
      createdAt: new Date().toISOString(),
    };

    const created = await messageRepo.create(message);

    // Update parent message reply count if this is a thread reply
    if (threadId) {
      const parent = await messageRepo.findById(channelId, threadId);
      if (parent) {
        await messageRepo.update(channelId, threadId, {
          replyCount: parent.replyCount + 1,
        } as Partial<ChannelMessage>);
      }
    }

    // Touch channel lastMessageAt
    await channelService.touchLastMessage(serverId, channelId);

    eventBus.emit("message:sent", { channelId, serverId, message: created });

    return created;
  },

  async sendSystem(channelId: string, serverId: string, content: string): Promise<ChannelMessage> {
    return this.send(channelId, serverId, "system", content, "system");
  },

  async getMessages(channelId: string, limit = 50, before?: string): Promise<ChannelMessage[]> {
    return messageRepo.findByChannel(channelId, limit, before);
  },

  async getThread(channelId: string, threadId: string): Promise<ChannelMessage[]> {
    return messageRepo.getThreadMessages(channelId, threadId);
  },

  async edit(channelId: string, messageId: string, userId: string, content: string): Promise<ChannelMessage> {
    const msg = await messageRepo.findById(channelId, messageId);
    if (!msg) throw notFound("Message not found");
    if (msg.authorId !== userId) throw forbidden("Can only edit your own messages");
    if (msg.deleted) throw badRequest("Cannot edit deleted message");

    const updated = await messageRepo.update(channelId, messageId, {
      content: content.trim(),
      mentions: parseMentions(content),
      edited: true,
    } as Partial<ChannelMessage>);

    return updated!;
  },

  async delete(channelId: string, messageId: string, userId: string, isAdmin = false): Promise<void> {
    const msg = await messageRepo.findById(channelId, messageId);
    if (!msg) throw notFound("Message not found");
    if (msg.authorId !== userId && !isAdmin) throw forbidden("Can only delete your own messages");

    await messageRepo.softDelete(channelId, messageId);
    eventBus.emit("message:deleted", { channelId, messageId });
  },

  async react(channelId: string, messageId: string, emoji: string, userId: string): Promise<ChannelMessage> {
    const updated = await messageRepo.addReaction(channelId, messageId, emoji, userId);
    if (!updated) throw notFound("Message not found");

    eventBus.emit("message:reacted", { channelId, messageId, emoji, userId });
    return updated;
  },

  async pin(channelId: string, serverId: string, messageId: string): Promise<ChannelMessage> {
    const msg = await messageRepo.findById(channelId, messageId);
    if (!msg) throw notFound("Message not found");

    const updated = await messageRepo.update(channelId, messageId, {
      pinned: !msg.pinned,
    } as Partial<ChannelMessage>);

    await channelService.togglePin(serverId, channelId, messageId);

    return updated!;
  },

  async sendLobby(channelId: string, authorId: string, content: string): Promise<ChannelMessage> {
    if (!content || content.trim().length === 0) {
      throw badRequest("Message content cannot be empty");
    }

    const message: ChannelMessage = {
      id: generateId(),
      channelId,
      authorId,
      content: content.trim(),
      type: "text",
      embeds: [],
      mentions: parseMentions(content),
      reactions: [],
      replyCount: 0,
      pinned: false,
      edited: false,
      deleted: false,
      createdAt: new Date().toISOString(),
    };

    return messageRepo.create(message);
  },

  async getUnreadCount(channelId: string, lastReadMessageId: string): Promise<number> {
    return messageRepo.countAfter(channelId, lastReadMessageId);
  },
};
