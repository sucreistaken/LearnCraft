import path from "path";
import fs from "fs";
import { BaseRepository } from "./baseRepository";

export interface ChannelPermissionOverride {
  roleId: string;
  allow: string[];
  deny: string[];
}

export interface Channel {
  id: string;
  serverId: string;
  categoryId: string;
  name: string;
  type: "text" | "study-tool" | "announcement";
  toolType?: "deep-dive" | "flashcards" | "mind-map" | "notes" | "quiz" | "sprint";
  lessonId?: string;
  lessonTitle?: string;
  permissionOverrides: ChannelPermissionOverride[];
  pinnedMessageIds: string[];
  lastMessageAt: string;
  createdAt: string;
}

const CHANNELS_DIR = path.join(__dirname, "..", "data", "channels");

class ChannelRepository {
  private getFilePath(serverId: string): string {
    return path.join(CHANNELS_DIR, `${serverId}.json`);
  }

  private getRepo(serverId: string): BaseRepository<Channel> {
    return new BaseRepository<Channel>(this.getFilePath(serverId));
  }

  async findAllByServer(serverId: string): Promise<Channel[]> {
    return this.getRepo(serverId).findAll();
  }

  async findById(serverId: string, channelId: string): Promise<Channel | null> {
    return this.getRepo(serverId).findById(channelId);
  }

  async findByIdGlobal(channelId: string): Promise<Channel | null> {
    // Search across all server channel files
    if (!fs.existsSync(CHANNELS_DIR)) return null;
    const files = fs.readdirSync(CHANNELS_DIR).filter((f) => f.endsWith(".json"));
    for (const file of files) {
      const serverId = file.replace(".json", "");
      const channel = await this.getRepo(serverId).findById(channelId);
      if (channel) return channel;
    }
    return null;
  }

  async create(channel: Channel): Promise<Channel> {
    return this.getRepo(channel.serverId).create(channel);
  }

  async update(serverId: string, channelId: string, updates: Partial<Channel>): Promise<Channel | null> {
    return this.getRepo(serverId).update(channelId, updates);
  }

  async delete(serverId: string, channelId: string): Promise<boolean> {
    return this.getRepo(serverId).delete(channelId);
  }

  async deleteAllByServer(serverId: string): Promise<void> {
    const filePath = this.getFilePath(serverId);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }

  async findByCategory(serverId: string, categoryId: string): Promise<Channel[]> {
    const repo = this.getRepo(serverId);
    return repo.findBy((c) => c.categoryId === categoryId);
  }
}

export const channelRepo = new ChannelRepository();
