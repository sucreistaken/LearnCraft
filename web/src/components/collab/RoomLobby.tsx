import React, { useEffect } from "react";
import { motion } from "framer-motion";
import { useRoomStore } from "../../stores/roomStore";
import { StudyRoom } from "../../types";

export default function RoomLobby() {
  const setShowCreate = useRoomStore((s) => s.setShowCreateModal);
  const setShowJoin = useRoomStore((s) => s.setShowJoinModal);
  const identity = useRoomStore((s) => s.identity);
  const myRooms = useRoomStore((s) => s.myRooms);
  const loadMyRooms = useRoomStore((s) => s.loadMyRooms);
  const joinRoom = useRoomStore((s) => s.joinRoom);

  useEffect(() => {
    if (identity) loadMyRooms();
  }, [identity?.id]);

  return (
    <div className="ws-lobby">
      <div className="ws-lobby__hero">
        <div className="ws-lobby__icon">{"\uD83D\uDCDA"}</div>
        <h2 className="ws-lobby__title">Study Workspace</h2>
        <p className="ws-lobby__desc">
          Create a persistent workspace linked to a lesson. Collaborate with Deep Dive AI chat,
          build flashcards together, annotate mind maps, and share notes.
        </p>

        {identity && (
          <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 16 }}>
            Studying as <strong>{identity.nickname}</strong>
          </p>
        )}

        <div className="ws-lobby__actions">
          <motion.button
            className="btn btn-primary"
            onClick={() => setShowCreate(true)}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            style={{ minWidth: 160 }}
          >
            Create Workspace
          </motion.button>
          <motion.button
            className="btn btn-secondary"
            onClick={() => setShowJoin(true)}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            style={{ minWidth: 160 }}
          >
            Join with Code
          </motion.button>
        </div>
      </div>

      {myRooms.length > 0 && (
        <div className="ws-lobby__rooms">
          <div className="ws-lobby__rooms-title">My Workspaces</div>
          {myRooms.map((room) => (
            <RoomCard key={room.id} room={room} onJoin={() => joinRoom(room.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function RoomCard({ room, onJoin }: { room: StudyRoom; onJoin: () => void }) {
  const onlineCount = room.participants?.length || 0;
  const memberCount = room.members?.length || 0;
  const lastActivity = room.members?.reduce((latest, m) => {
    return m.lastSeenAt > latest ? m.lastSeenAt : latest;
  }, room.createdAt) || room.createdAt;

  return (
    <div className="ws-room-card" onClick={onJoin}>
      <div className="ws-room-card__info">
        <div className="ws-room-card__name">{room.name}</div>
        <div className="ws-room-card__lesson">{room.lessonTitle || "No lesson linked"}</div>
      </div>

      <div className="ws-room-card__stats">
        <div className="ws-room-card__online">
          {onlineCount > 0 ? (
            <>
              <span className="ws-room-card__online-dot" />
              <span>{onlineCount} online</span>
            </>
          ) : (
            <span style={{ color: "var(--muted)" }}>{memberCount} members</span>
          )}
        </div>
        <div className="ws-room-card__time">{getTimeAgo(lastActivity)}</div>
      </div>

      <div className="ws-room-card__code">{room.code}</div>
    </div>
  );
}

function getTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}
