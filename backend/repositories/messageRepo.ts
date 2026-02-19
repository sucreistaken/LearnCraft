import path from "path";
import fs from "fs";
import { BaseRepository } from "./baseRepository";

export interface MessageReaction {
  emoji: string;
  userIds: string[];
}

export interface MessageEmbed {
  type: "tool-result" | "quiz-score" | "achievement";
  title: string;
  description: string;
  color?: string;
  fields?: { name: string; value: string }[];
}

export interface ChannelMessage {
  id: string;
  channelId: string;
  authorId: string;
  content: string;
  type: "text" | "system" | "embed";
  embeds: MessageEmbed[];
  mentions: string[];
  reactions: MessageReaction[];
  threadId?: string;
  replyCount: number;
  pinned: boolean;
  edited: boolean;
  deleted: boolean;
  createdAt: string;
}

const MESSAGES_DIR = path.join(__dirname, "..", "data", "messages");

class MessageRepository {
  private getFilePath(channelId: string): string {
    return path.join(MESSAGES_DIR, `${channelId}.json`);
  }

  private getRepo(channelId: string): BaseRepository<ChannelMessage> {
    return new BaseRepository<ChannelMessage>(this.getFilePath(channelId));
  }

  async findByChannel(channelId: string, limit = 50, before?: string): Promise<ChannelMessage[]> {
    const repo = this.getRepo(channelId);
    let messages = await repo.findBy((m) => !m.deleted);

    // Sort by date descending
    messages.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    if (before) {
      const idx = messages.findIndex((m) => m.id === before);
      if (idx !== -1) messages = messages.slice(idx + 1);
    }

    return messages.slice(0, limit).reverse();
  }

  async findById(channelId: string, messageId: string): Promise<ChannelMessage | null> {
    return this.getRepo(channelId).findById(messageId);
  }

  async create(message: ChannelMessage): Promise<ChannelMessage> {
    return this.getRepo(message.channelId).create(message);
  }

  async update(channelId: string, messageId: string, updates: Partial<ChannelMessage>): Promise<ChannelMessage | null> {
    return this.getRepo(channelId).update(messageId, updates);
  }

  async softDelete(channelId: string, messageId: string): Promise<ChannelMessage | null> {
    return this.getRepo(channelId).update(messageId, {
      deleted: true,
      content: "",
    } as Partial<ChannelMessage>);
  }

  async getThreadMessages(channelId: string, threadId: string): Promise<ChannelMessage[]> {
    const repo = this.getRepo(channelId);
    const messages = await repo.findBy((m) => m.threadId === threadId && !m.deleted);
    messages.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    return messages;
  }

  async addReaction(channelId: string, messageId: string, emoji: string, userId: string): Promise<ChannelMessage | null> {
    const msg = await this.findById(channelId, messageId);
    if (!msg) return null;

    const reactions = [...msg.reactions];
    const existing = reactions.find((r) => r.emoji === emoji);
    if (existing) {
      if (existing.userIds.includes(userId)) {
        // Remove reaction
        existing.userIds = existing.userIds.filter((id) => id !== userId);
        if (existing.userIds.length === 0) {
          const idx = reactions.indexOf(existing);
          reactions.splice(idx, 1);
        }
      } else {
        existing.userIds.push(userId);
      }
    } else {
      reactions.push({ emoji, userIds: [userId] });
    }

    return this.getRepo(channelId).update(messageId, { reactions } as Partial<ChannelMessage>);
  }

  async countAfter(channelId: string, afterMessageId: string): Promise<number> {
    const repo = this.getRepo(channelId);
    const messages = await repo.findAll();
    const afterMsg = messages.find((m) => m.id === afterMessageId);
    if (!afterMsg) return messages.filter((m) => !m.deleted).length;

    return messages.filter(
      (m) => !m.deleted && new Date(m.createdAt).getTime() > new Date(afterMsg.createdAt).getTime()
    ).length;
  }

  async deleteAllByChannel(channelId: string): Promise<void> {
    const filePath = this.getFilePath(channelId);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
}

export const messageRepo = new MessageRepository();
