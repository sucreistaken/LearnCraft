import React, { useState, useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { API_BASE } from "../../config";

type ChatMessage = {
  author: string;
  text: string;
  time: string;
};

let socket: Socket | null = null;

function getSocket(): Socket {
  if (!socket) {
    socket = io(API_BASE, { transports: ["websocket", "polling"] });
  }
  return socket;
}

export default function StudyRoom({
  shareId,
  onClose,
}: {
  shareId: string;
  onClose: () => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [username] = useState(() => `user-${Math.random().toString(36).slice(2, 6)}`);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const chatRef = useRef<HTMLDivElement>(null);
  const roomId = `room-${shareId}`;

  useEffect(() => {
    const s = getSocket();

    s.emit("join-room", roomId, username);

    s.on("presence", (users: string[]) => {
      setOnlineUsers(users);
    });

    s.on("chat-message", (msg: ChatMessage) => {
      setMessages((prev) => [...prev, msg]);
    });

    return () => {
      s.emit("leave-room");
      s.off("presence");
      s.off("chat-message");
    };
  }, [roomId, username]);

  // Auto-scroll on new messages
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = () => {
    if (!input.trim()) return;
    const s = getSocket();
    s.emit("chat-message", { roomId, author: username, text: input.trim() });
    setInput("");
  };

  return (
    <div className="study-room">
      {/* Header */}
      <div className="study-room__header">
        <div>
          <div className="study-room__title">Study Room</div>
          <div className="study-room__count">
            <span className="study-room__dot" />
            {onlineUsers.length} online
          </div>
        </div>
        <button className="study-room__close" onClick={onClose} aria-label="Close">
          &#215;
        </button>
      </div>

      {/* Online Users */}
      {onlineUsers.length > 0 && (
        <div className="study-room__users">
          {onlineUsers.map((u, i) => (
            <span
              key={i}
              className={`study-room__user-tag${u === username ? " study-room__user-tag--self" : ""}`}
            >
              {u}
            </span>
          ))}
        </div>
      )}

      {/* Messages */}
      <div ref={chatRef} className="study-room__messages">
        {messages.length === 0 && (
          <div className="study-room__empty">
            No messages yet. Say hello!
          </div>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`study-room__msg${msg.author === username ? " study-room__msg--self" : " study-room__msg--other"}`}
          >
            <div
              className={`study-room__bubble${msg.author === username ? " study-room__bubble--self" : " study-room__bubble--other"}`}
            >
              {msg.text}
            </div>
            <div className="study-room__msg-meta">
              {msg.author} &middot;{" "}
              {typeof msg.time === "string" && msg.time.includes("T")
                ? new Date(msg.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                : msg.time}
            </div>
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="study-room__input-area">
        <input
          className="study-room__input"
          placeholder="Type a message..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") sendMessage();
          }}
        />
        <button
          className="study-room__send"
          onClick={sendMessage}
          disabled={!input.trim()}
        >
          Send
        </button>
      </div>
    </div>
  );
}
