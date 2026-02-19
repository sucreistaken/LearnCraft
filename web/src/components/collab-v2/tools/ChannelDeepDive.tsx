import { useState, useRef, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { useChannelToolStore } from "../../../stores/channelToolStore";
import { channelToolApi } from "../../../services/channelToolApi";
import { getCollabSocket } from "../../../services/collabSocket";
import type { ChannelDeepDiveMessage, ChannelNoteItem, LessonContextInfo } from "../../../types";

interface Props {
  channelId: string;
  topic: string;
  serverName: string;
  userId: string;
  nickname: string;
  lessonContext?: LessonContextInfo | null;
}

const EMPTY_MSGS: ChannelDeepDiveMessage[] = [];

const AVATAR_COLORS = ["#6366f1", "#ec4899", "#f59e0b", "#22c55e", "#06b6d4", "#8b5cf6"];

function hashAuthorColor(authorId: string): string {
  let hash = 0;
  for (let i = 0; i < authorId.length; i++) {
    hash = (hash * 31 + authorId.charCodeAt(i)) | 0;
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function formatTime(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

const QUICK_ACTIONS = [
  { label: "\u{1F4DD} \u00D6zetle", prompt: "Bu konuyu \u00F6zetle: " },
  { label: "\u2753 Soru sor", prompt: "Bu konuyla ilgili bana bir soru sor: " },
  { label: "\u{1F4A1} \u00D6rnekler", prompt: "Bu konuyla ilgili ger\u00E7ek d\u00FCnya \u00F6rnekleri ver: " },
  { label: "\u{1F517} Ba\u011Flant\u0131lar", prompt: "Bu konunun di\u011Fer konularla ba\u011Flant\u0131lar\u0131n\u0131 g\u00F6ster: " },
];

/** Quick action metadata for card grid */
const QUICK_ACTION_META: Record<string, { icon: string; desc: string }> = {
  "\u{1F4DD} \u00D6zetle": { icon: "\u{1F4DD}", desc: "Konunun k\u0131sa ve net \u00F6zeti" },
  "\u2753 Soru sor": { icon: "\u2753", desc: "Anlama seviyeni test et" },
  "\u{1F4A1} \u00D6rnekler": { icon: "\u{1F4A1}", desc: "Ger\u00E7ek hayattan \u00F6rnekler" },
  "\u{1F517} Ba\u011Flant\u0131lar": { icon: "\u{1F517}", desc: "Di\u011Fer konularla ili\u015Fkiler" },
  "\uD83C\uDFAF Hocan\u0131n Vurgular\u0131": { icon: "\uD83C\uDFAF", desc: "Derste vurgulanan noktalar" },
  "\u26A0\uFE0F Yayg\u0131n Hatalar": { icon: "\u26A0\uFE0F", desc: "S\u0131k yap\u0131lan yan\u0131lg\u0131lar" },
  "\uD83D\uDCA1 Temel Fikirler": { icon: "\uD83D\uDCA1", desc: "\u00C7ekirdek kavramlar ve fikirler" },
};

/** Render text with basic formatting: paragraphs, inline code, code blocks */
function renderFormattedText(text: string) {
  // Split by code blocks first (```...```)
  const codeBlockRegex = /```(\w*)\n?([\s\S]*?)```/g;
  const parts: Array<{ type: "text"; value: string } | { type: "code"; lang: string; value: string }> = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = codeBlockRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "text", value: text.slice(lastIndex, match.index) });
    }
    parts.push({ type: "code", lang: match[1] || "", value: match[2].trim() });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push({ type: "text", value: text.slice(lastIndex) });
  }

  return parts.map((part, i) => {
    if (part.type === "code") {
      return (
        <pre key={i} className="sh-dive__code-block">
          <code>{part.value}</code>
        </pre>
      );
    }
    // For text parts: split into paragraphs and handle inline code
    const paragraphs = part.value.split(/\n{2,}/);
    return paragraphs.map((para, j) => {
      const trimmed = para.trim();
      if (!trimmed) return null;
      // Handle inline code with backticks
      const inlineParts = trimmed.split(/(`[^`]+`)/g);
      return (
        <p key={`${i}-${j}`} className="sh-dive__paragraph">
          {inlineParts.map((seg, k) => {
            if (seg.startsWith("`") && seg.endsWith("`")) {
              return (
                <code key={k} className="sh-dive__inline-code">
                  {seg.slice(1, -1)}
                </code>
              );
            }
            return <span key={k}>{seg}</span>;
          })}
        </p>
      );
    });
  });
}

export default function ChannelDeepDive({ channelId, topic, serverName, userId, nickname, lessonContext }: Props) {
  // Zustand selectors - derive state inline, never call methods in selectors
  const messages = useChannelToolStore(
    (s) => s.dataByChannel[channelId]?.deepDive?.messages ?? EMPTY_MSGS
  );
  const addDeepDiveMessages = useChannelToolStore((s) => s.addDeepDiveMessages);

  const addNoteToStore = useChannelToolStore((s) => s.addNoteToStore);

  // Local state
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [savedMsgId, setSavedMsgId] = useState<string | null>(null);

  // Dynamic quick actions based on lesson context
  const quickActions = useMemo(() => {
    const base = [...QUICK_ACTIONS];
    if (lessonContext?.linked) {
      if ((lessonContext.emphasesCount || 0) > 0) {
        base.push({ label: "\uD83C\uDFAF Hocan\u0131n Vurgular\u0131", prompt: "Hocan\u0131n vurgulad\u0131\u011F\u0131 en \u00F6nemli noktalar\u0131 a\u00E7\u0131kla: " });
      }
      if (lessonContext.hasCheatSheet) {
        base.push({ label: "\u26A0\uFE0F Yayg\u0131n Hatalar", prompt: "Bu konuda \u00F6\u011Frencilerin en s\u0131k yapt\u0131\u011F\u0131 hatalar\u0131 ve yan\u0131lg\u0131lar\u0131 a\u00E7\u0131kla: " });
      }
      if (lessonContext.hasLoModules) {
        base.push({ label: "\uD83D\uDCA1 Temel Fikirler", prompt: "Dersin temel fikirlerini ve \u00E7ekirdek kavramlar\u0131n\u0131 \u00F6zetle: " });
      }
    }
    return base;
  }, [lessonContext]);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Send message handler
  async function handleSend(text?: string) {
    const messageText = text ?? input.trim();
    if (!messageText || loading) return;

    setInput("");
    setLoading(true);

    try {
      const { userMessage, aiMessage } = await channelToolApi.deepDiveChat(
        channelId,
        messageText,
        userId,
        nickname,
        topic,
        serverName
      );

      addDeepDiveMessages(channelId, [userMessage, aiMessage]);
      getCollabSocket().emit("tool:deepdive:msg", {
        channelId,
        userMessage,
        aiMessage,
      });
    } catch (err) {
      console.error("Deep dive chat failed:", err);
    } finally {
      setLoading(false);
    }
  }

  // Quick action handler
  function handleQuickAction(prompt: string) {
    handleSend(prompt + topic);
  }

  // Save AI message as note
  async function handleSaveAsNote(msg: ChannelDeepDiveMessage) {
    try {
      const title = `Deep Dive: ${topic}`;
      const content = msg.text;
      const { note } = await channelToolApi.addNote(
        channelId, title, content, "summary", userId, nickname
      );
      addNoteToStore(channelId, note);
      getCollabSocket().emit("tool:notes:add", { channelId, note });
      setSavedMsgId(msg.id);
      setTimeout(() => setSavedMsgId(null), 2000);
    } catch (err) {
      console.error("Failed to save as note:", err);
    }
  }

  // Handle keyboard submit
  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  // Empty state
  if (messages.length === 0 && !loading) {
    return (
      <div className="sh-tool">
        {/* Header */}
        <div className="sh-tool__header">
          <div className="sh-tool__header-left">
            <div className="sh-dive__header-icon">
              <span>{"\u{1F52C}"}</span>
            </div>
            <div className="sh-dive__header-info">
              <h3 className="sh-main-content__channel-name">{topic}</h3>
              <span className="sh-dive__subtitle">Grup AI Sohbeti</span>
            </div>
          </div>
        </div>

        <div className="sh-tool__body">
          {/* Hero empty state */}
          <div className="sh-dive__empty-hero">
            <div className="sh-dive__empty-icon-ring">
              <span className="sh-dive__empty-icon-inner">{"\u{1F52C}"}</span>
            </div>
            <h3 className="sh-dive__empty-title">Birlikte Ke{"\u015F"}fedin</h3>
            <p className="sh-dive__empty-desc">
              Konuyla ilgili sorular sorun, AI asistan{"\u0131"} herkese yard{"\u0131"}mc{"\u0131"} olacak.
              {"\n"}A{"\u015F"}a{"\u011F"}{"\u0131"}daki aksiyonlardan birini se{"\u00E7"}erek ba{"\u015F"}layabilirsiniz.
            </p>
          </div>

          {/* Quick actions as card grid */}
          <div className="sh-dive__action-grid">
            {quickActions.map((action) => {
              const meta = QUICK_ACTION_META[action.label];
              return (
                <button
                  key={action.label}
                  className="sh-dive__action-card"
                  onClick={() => handleQuickAction(action.prompt)}
                  disabled={loading}
                >
                  <span className="sh-dive__action-card-icon">
                    {meta?.icon ?? "\u2728"}
                  </span>
                  <div className="sh-dive__action-card-body">
                    <span className="sh-dive__action-card-title">
                      {action.label.replace(/^\S+\s/, "")}
                    </span>
                    <span className="sh-dive__action-card-desc">
                      {meta?.desc ?? ""}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Input area */}
          <div className="sh-dive__input">
            <div className="sh-message-input__wrapper">
              <textarea
                ref={textareaRef}
                className="sh-message-input__textarea"
                placeholder="Bir soru sorun..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={1}
                disabled={loading}
              />
              <button
                className="sh-message-input__send"
                onClick={() => handleSend()}
                disabled={!input.trim() || loading}
              >
                {loading ? "\u23F3" : "\u27A4"}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="sh-tool">
      {/* Header */}
      <div className="sh-tool__header">
        <div className="sh-tool__header-left">
          <div className="sh-dive__header-icon">
            <span>{"\u{1F52C}"}</span>
          </div>
          <div className="sh-dive__header-info">
            <h3 className="sh-main-content__channel-name">{topic}</h3>
            <span className="sh-dive__subtitle">Grup AI Sohbeti</span>
          </div>
        </div>
        <div className="sh-tool__header-right">
          <span className="sh-dive__msg-count">
            {messages.length} mesaj
          </span>
        </div>
      </div>

      <div className="sh-tool__body" style={{ padding: 0 }}>
        {/* Message list */}
        <div className="sh-dive__messages">
          {messages.map((msg) => {
            const isAI = msg.role === "assistant";
            return (
              <motion.div
                key={msg.id}
                className={`sh-dive__bubble-row ${isAI ? "sh-dive__bubble-row--ai" : "sh-dive__bubble-row--user"}`}
                initial={{ y: 12, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ type: "spring", stiffness: 340, damping: 28 }}
              >
                {/* Avatar -- only for AI (left side) */}
                {isAI && (
                  <div className="sh-dive__avatar sh-dive__avatar--ai">
                    <span>{"\u{1F916}"}</span>
                  </div>
                )}

                <div className={`sh-dive__bubble ${isAI ? "sh-dive__bubble--ai" : "sh-dive__bubble--user"}`}>
                  {/* Author line */}
                  <div className="sh-dive__bubble-meta">
                    <span className="sh-dive__bubble-author">
                      {isAI ? "Study AI" : msg.authorNickname}
                    </span>
                    <time className="sh-dive__bubble-time">{formatTime(msg.timestamp)}</time>
                  </div>

                  {/* Message body */}
                  <div className="sh-dive__bubble-text">
                    {isAI ? renderFormattedText(msg.text) : msg.text}
                  </div>

                  {/* Save as note -- AI only, visible on hover */}
                  {isAI && (
                    <div className="sh-dive__bubble-actions">
                      <button
                        className={`sh-dive__save-btn ${savedMsgId === msg.id ? "sh-dive__save-btn--saved" : ""}`}
                        onClick={() => handleSaveAsNote(msg)}
                        disabled={savedMsgId === msg.id}
                        title="Not olarak kaydet"
                      >
                        <svg className="sh-dive__save-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path d="M3 1h7l3 3v9a2 2 0 0 1-2 2H3a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1z" />
                          <path d="M5 1v4h5V1" />
                          <path d="M5 10h6" />
                          <path d="M5 12.5h4" />
                        </svg>
                        <span>{savedMsgId === msg.id ? "Kaydedildi" : "Not olarak kaydet"}</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Avatar -- only for User (right side) */}
                {!isAI && (
                  <div
                    className="sh-dive__avatar sh-dive__avatar--user"
                    style={{ background: `linear-gradient(135deg, ${hashAuthorColor(msg.authorId)}, ${hashAuthorColor(msg.authorId)}dd)` }}
                  >
                    <span>{msg.authorNickname.charAt(0).toUpperCase()}</span>
                  </div>
                )}
              </motion.div>
            );
          })}

          {/* Typing indicator with animated dots */}
          {loading && (
            <div className="sh-dive__bubble-row sh-dive__bubble-row--ai">
              <div className="sh-dive__avatar sh-dive__avatar--ai">
                <span>{"\u{1F916}"}</span>
              </div>
              <div className="sh-dive__typing-bubble">
                <span className="sh-dive__typing-label">Study AI d{"\u00FC"}{"\u015F"}{"\u00FC"}n{"\u00FC"}yor</span>
                <span className="sh-dive__typing-dots">
                  <span className="sh-dive__dot" />
                  <span className="sh-dive__dot" />
                  <span className="sh-dive__dot" />
                </span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick action buttons -- compact pills in chat view */}
        <div className="sh-dive__quick-actions">
          {quickActions.map((action) => (
            <button
              key={action.label}
              className="sh-dive__quick-btn"
              onClick={() => handleQuickAction(action.prompt)}
              disabled={loading}
            >
              {action.label}
            </button>
          ))}
        </div>

        {/* Input area */}
        <div className="sh-dive__input">
          <div className="sh-message-input__wrapper">
            <textarea
              ref={textareaRef}
              className="sh-message-input__textarea"
              placeholder="Bir soru sorun..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              disabled={loading}
            />
            <button
              className="sh-message-input__send"
              onClick={() => handleSend()}
              disabled={!input.trim() || loading}
            >
              {loading ? "\u23F3" : "\u27A4"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
