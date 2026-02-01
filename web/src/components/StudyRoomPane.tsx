import React, { useState, useEffect, useRef } from "react";
import { useRoomStore } from "../stores/roomStore";
import RoomLobby from "./collab/RoomLobby";
import CreateRoomModal from "./collab/CreateRoomModal";
import JoinRoomModal from "./collab/JoinRoomModal";
import WorkspaceLayout from "./collab/WorkspaceLayout";

const MAX_VISIBLE_AVATARS = 5;

function RoomHeader() {
  const room = useRoomStore((s) => s.currentRoom);
  const participants = useRoomStore((s) => s.participants);
  const leaveRoom = useRoomStore((s) => s.leaveRoom);
  const chatOpen = useRoomStore((s) => s.chatOpen);
  const setChatOpen = useRoomStore((s) => s.setChatOpen);
  const chat = useRoomStore((s) => s.chat);
  const [copied, setCopied] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const lastChatLenRef = useRef(chat.length);

  useEffect(() => {
    if (chatOpen) {
      setUnreadCount(0);
      lastChatLenRef.current = chat.length;
    } else {
      const newMessages = chat.length - lastChatLenRef.current;
      if (newMessages > 0) {
        setUnreadCount((prev) => prev + newMessages);
      }
      lastChatLenRef.current = chat.length;
    }
  }, [chat.length, chatOpen]);

  if (!room) return null;

  const copyCode = async () => {
    try {
      const url = `${window.location.origin}?room=${room.code}`;
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Room link:", `${window.location.origin}?room=${room.code}`);
    }
  };

  const visibleAvatars = participants.slice(0, MAX_VISIBLE_AVATARS);
  const extraCount = participants.length - MAX_VISIBLE_AVATARS;

  return (
    <div className="ws-header">
      <div className="ws-header__title">{room.name}</div>
      {room.lessonTitle && <span className="ws-header__pill">{room.lessonTitle}</span>}

      <div className="ws-header__avatars">
        {visibleAvatars.map((p) => (
          <div
            key={p.id}
            className="ws-header__avatar"
            style={{ background: p.avatar }}
            title={p.nickname}
          >
            {p.nickname.charAt(0).toUpperCase()}
          </div>
        ))}
        {extraCount > 0 && (
          <div className="ws-header__avatar-more">+{extraCount}</div>
        )}
      </div>
      <span className="ws-header__online-count">{participants.length} online</span>

      <div style={{ flex: 1 }} />

      <button className="btn-small ws-header__code" onClick={copyCode} title="Copy invite link">
        {copied ? "Copied!" : room.code}
      </button>

      <button
        className={`ws-header__chat-toggle${chatOpen ? " ws-header__chat-toggle--active" : ""}`}
        onClick={() => {
          setChatOpen(!chatOpen);
          if (!chatOpen) setUnreadCount(0);
        }}
        title="Toggle chat"
      >
        {"\uD83D\uDCAC"}
        {unreadCount > 0 && !chatOpen && (
          <span className="ws-header__chat-badge">{unreadCount > 9 ? "9+" : unreadCount}</span>
        )}
      </button>

      <button className="btn-small" onClick={leaveRoom} style={{ color: "var(--danger)" }}>Leave</button>
    </div>
  );
}

export default function StudyRoomPane() {
  const currentRoom = useRoomStore((s) => s.currentRoom);

  if (!currentRoom) {
    return (
      <>
        <RoomLobby />
        <CreateRoomModal />
        <JoinRoomModal />
      </>
    );
  }

  return (
    <div className="ws-shell">
      <RoomHeader />
      <WorkspaceLayout />
    </div>
  );
}
