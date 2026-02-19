export interface EventMap {
  // Message events
  "message:sent": { channelId: string; serverId: string; message: any };
  "message:deleted": { channelId: string; messageId: string };
  "message:reacted": { channelId: string; messageId: string; emoji: string; userId: string };

  // Member events
  "member:joined": { serverId: string; userId: string };
  "member:left": { serverId: string; userId: string };

  // Quiz events
  "quiz:completed": { channelId: string; serverId: string; participants: any[] };

  // Contribution events
  "contribution:made": {
    serverId: string;
    userId: string;
    type: "message" | "flashcard" | "note" | "annotation" | "quiz" | "insight";
  };

  // Profile events
  "profile:statusChanged": { userId: string; status: string };

  // Server events
  "server:created": { serverId: string; ownerId: string };
  "server:deleted": { serverId: string };
}

export type EventName = keyof EventMap;
