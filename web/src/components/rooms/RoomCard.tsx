import React from "react";
import type { StudyServer } from "../../types";

interface Props {
  room: StudyServer;
  onJoin?: (roomId: string) => void;
  onSelect?: (roomId: string) => void;
  isMember?: boolean;
}

export default function RoomCard({ room, onJoin, onSelect, isMember }: Props) {
  return (
    <div className="sh-room-card" onClick={() => (isMember ? onSelect?.(room.id) : undefined)}>
      <div
        className="sh-room-card__icon"
        style={{ backgroundColor: room.iconColor || "#5865F2" }}
      >
        {room.name.charAt(0).toUpperCase()}
      </div>
      <div className="sh-room-card__body">
        <div className="sh-room-card__name">{room.name}</div>
        <div className="sh-room-card__topic">{room.description || "No topic"}</div>
        <div className="sh-room-card__meta">
          <span>{room.memberCount || room.memberIds?.length || 0} members</span>
          {room.tags?.length > 0 && (
            <span className="sh-room-card__tags">
              {room.tags.slice(0, 3).map((tag) => (
                <span key={tag} className="sh-room-card__tag">{tag}</span>
              ))}
            </span>
          )}
        </div>
      </div>
      {!isMember && onJoin && (
        <button
          className="sh-room-card__join"
          onClick={(e) => { e.stopPropagation(); onJoin(room.id); }}
        >
          Join
        </button>
      )}
      {isMember && (
        <button
          className="sh-room-card__enter"
          onClick={(e) => { e.stopPropagation(); onSelect?.(room.id); }}
        >
          Enter
        </button>
      )}
    </div>
  );
}
