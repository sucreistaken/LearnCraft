import React, { useState, useRef, useEffect } from "react";
import { useRoomStore } from "../../stores/roomStore";
import { RoomChatMessage } from "../../types";

export default function CompactChat({ onClose }: { onClose: () => void }) {
  const chat = useRoomStore((s) => s.chat);
  const sendChat = useRoomStore((s) => s.sendChat);
  const identity = useRoomStore((s) => s.identity);
  const [input, setInput] = useState("");
  const chatRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [chat]);

  const handleSend = () => {
    if (!input.trim()) return;
    sendChat(input);
    setInput("");
  };

  const lastMessages = chat.slice(-50);

  return (
    <div className="ws-chat-panel">
      <div className="ws-chat-panel__head">
        <span className="ws-chat-panel__head-title">Chat</span>
        <button
          className="btn-small"
          onClick={onClose}
          style={{ padding: "2px 8px", marginLeft: "auto" }}
        >
          {"\u2715"}
        </button>
      </div>

      <div ref={chatRef} className="ws-chat-panel__messages">
        {lastMessages.length === 0 && (
          <div className="ws-chat__msg--system">No messages yet</div>
        )}
        {lastMessages.map((msg) => (
          <ChatBubble key={msg.id} msg={msg} isSelf={msg.authorId === identity?.id} />
        ))}
      </div>

      <div className="ws-chat-panel__input-row">
        <input
          className="lc-textarea"
          placeholder="Message..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSend();
          }}
        />
        <button className="btn-small" onClick={handleSend} disabled={!input.trim()}>
          Send
        </button>
      </div>
    </div>
  );
}

function ChatBubble({ msg, isSelf }: { msg: RoomChatMessage; isSelf: boolean }) {
  if (msg.type === "system" || msg.type === "activity") {
    return <div className="ws-chat__msg--system">{msg.text}</div>;
  }

  return (
    <div className="ws-chat__msg">
      <span className={`ws-chat__msg-author${isSelf ? " ws-chat__msg-author--self" : ""}`}>
        {isSelf ? "You" : msg.author}:
      </span>{" "}
      <span>{msg.text}</span>
    </div>
  );
}
