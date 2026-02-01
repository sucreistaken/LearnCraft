import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRoomStore } from "../../stores/roomStore";
import { SharedChatMessage } from "../../types";
import InsightsPanel from "./InsightsPanel";

export default function SharedDeepDive() {
  const workspace = useRoomStore((s) => s.workspace);
  const askDeepDive = useRoomStore((s) => s.askDeepDive);
  const reactToMessage = useRoomStore((s) => s.reactToMessage);
  const saveAsInsight = useRoomStore((s) => s.saveAsInsight);
  const identity = useRoomStore((s) => s.identity);
  const currentRoom = useRoomStore((s) => s.currentRoom);

  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [showInsights, setShowInsights] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);

  const messages = workspace.deepDive.messages;
  const insights = workspace.deepDive.savedInsights;

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages.length]);

  const handleSend = async () => {
    if (!input.trim() || sending) return;
    const text = input.trim();
    setInput("");
    setSending(true);
    try {
      await askDeepDive(text);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="ws-dd">
      <div className="ws-dd__main">
        {/* Header */}
        <div className="ws-pane-head">
          <div className="ws-pane-head__icon" style={{ background: "var(--ring)", color: "var(--accent-2)" }}>
            {"\uD83E\uDDE0"}
          </div>
          <span className="ws-pane-head__title">Deep Dive</span>
          <span className="ws-pane-head__meta">{messages.length} messages</span>
          <div className="ws-pane-head__actions">
            {insights.length > 0 && (
              <button
                className="btn-small"
                onClick={() => setShowInsights(!showInsights)}
              >
                {"\uD83D\uDCCC"} {insights.length} insight{insights.length !== 1 ? "s" : ""}
              </button>
            )}
          </div>
        </div>

        {/* Messages */}
        <div ref={chatRef} className="ws-dd__messages">
          {messages.length === 0 && (
            <div className="pane-empty">
              <div className="pane-empty__icon">{"\uD83E\uDDE0"}</div>
              <div className="pane-empty__title">Group Deep Dive</div>
              <div className="pane-empty__desc">
                Ask the AI about {currentRoom?.lessonTitle || "the lesson"} together.
                Everyone sees the questions and answers. Save key insights for later.
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              msg={msg}
              isSelf={msg.authorId === identity?.id}
              onReact={() => reactToMessage(msg.id)}
              onSaveInsight={() => saveAsInsight(msg.id, [])}
              currentUserId={identity?.id || ""}
            />
          ))}

          {sending && (
            <div style={{ textAlign: "center", padding: 8 }}>
              <span className="ws-pane-head__meta">AI is thinking...</span>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="ws-dd__input-row">
          <input
            className="lc-textarea"
            placeholder="Ask the AI a question..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            disabled={sending}
            style={{ flex: 1 }}
          />
          <motion.button
            className="btn btn-primary"
            onClick={handleSend}
            disabled={!input.trim() || sending}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            style={{ padding: "6px 16px" }}
          >
            Ask
          </motion.button>
        </div>
      </div>

      {/* Insights side panel */}
      <AnimatePresence>
        {showInsights && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 300, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            style={{ overflow: "hidden" }}
          >
            <InsightsPanel onClose={() => setShowInsights(false)} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MessageBubble({
  msg,
  isSelf,
  onReact,
  onSaveInsight,
  currentUserId,
}: {
  msg: SharedChatMessage;
  isSelf: boolean;
  onReact: () => void;
  onSaveInsight: () => void;
  currentUserId: string;
}) {
  const isAI = msg.role === "assistant";
  const hasReacted = msg.reactions.some((r) => r.userId === currentUserId);

  return (
    <div className="ws-dd__msg">
      {/* Author line */}
      {!isAI && (
        <div className="ws-dd__msg-author">
          <div className="ws-dd__msg-avatar" style={{ background: msg.authorAvatar }}>
            {msg.authorNickname.charAt(0).toUpperCase()}
          </div>
          <span className="ws-dd__msg-name">{msg.authorNickname}</span>
          <span className="ws-dd__msg-time">
            {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
      )}

      {/* Message content */}
      {isAI ? (
        <div className="ws-dd__msg-body--ai">
          <div className="ws-dd__msg-ai-head">
            {"\uD83E\uDD16"} AI Assistant
          </div>
          <div className="ws-dd__msg-body">{msg.text}</div>
          <div className="ws-dd__msg-actions">
            <button
              className={`ws-dd__react-btn${hasReacted ? " ws-dd__react-btn--active" : ""}`}
              onClick={onReact}
            >
              {"\uD83D\uDC4D"} {msg.reactions.length > 0 && msg.reactions.length}
            </button>

            {!msg.savedAsInsight && (
              <button className="ws-dd__react-btn" onClick={onSaveInsight}>
                {"\uD83D\uDCCC"} Save insight
              </button>
            )}

            {msg.savedAsInsight && (
              <span className="ws-pane-head__meta">{"\u2713"} Saved as insight</span>
            )}
          </div>
        </div>
      ) : (
        <div className="ws-dd__msg-body ws-dd__msg-body--user">{msg.text}</div>
      )}
    </div>
  );
}
