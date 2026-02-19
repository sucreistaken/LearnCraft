import { useState } from "react";
import { useMessageStore } from "../../../stores/messageStore";
import { useProfileStore } from "../../../stores/profileStore";
import { useServerStore } from "../../../stores/serverStore";
import type { ChannelMessage } from "../../../types";

const QUICK_REACTIONS = ["👍", "❤️", "😂", "🎉", "🤔", "👀"];

interface Props {
  message: ChannelMessage;
  grouped: boolean;
  channelId: string;
}

export default function MessageItem({ message, grouped, channelId }: Props) {
  const profile = useProfileStore((s) => s.profile);
  const members = useServerStore((s) => s.members);
  const reactToMessage = useMessageStore((s) => s.reactToMessage);
  const deleteMessage = useMessageStore((s) => s.deleteMessage);
  const [showActions, setShowActions] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState(false);

  const author = members.find((m) => m.id === message.authorId);
  const isOwnMessage = profile?.id === message.authorId;
  const isSystem = message.type === "system";

  if (message.deleted) {
    return (
      <div className="sh-msg sh-msg--deleted">
        <span className="sh-msg__deleted-text">Bu mesaj silindi.</span>
      </div>
    );
  }

  if (isSystem) {
    return (
      <div className="sh-msg sh-msg--system">
        <span className="sh-msg__system-text">{message.content}</span>
      </div>
    );
  }

  const time = new Date(message.createdAt).toLocaleTimeString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div
      className={`sh-msg ${grouped ? "sh-msg--grouped" : ""}`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => {
        setShowActions(false);
        setShowReactionPicker(false);
      }}
    >
      {!grouped && (
        <div className="sh-msg__header">
          <div
            className="sh-msg__avatar"
            style={{ background: author?.avatar || "#636E72" }}
          >
            {(author?.nickname || "?").charAt(0).toUpperCase()}
          </div>
          <span className="sh-msg__author" style={{ color: author?.avatar }}>
            {author?.nickname || "Bilinmeyen"}
          </span>
          <span className="sh-msg__time">{time}</span>
          {message.edited && <span className="sh-msg__edited">(düzenlendi)</span>}
        </div>
      )}

      <div className="sh-msg__body">
        {grouped && (
          <span className="sh-msg__hover-time">{time}</span>
        )}
        <div className="sh-msg__content">{message.content}</div>
      </div>

      {/* Reactions */}
      {message.reactions.length > 0 && (
        <div className="sh-msg__reactions">
          {message.reactions.map((r) => (
            <button
              key={r.emoji}
              className={`sh-reaction ${r.userIds.includes(profile?.id || "") ? "sh-reaction--active" : ""}`}
              onClick={() => profile && reactToMessage(channelId, message.id, r.emoji, profile.id)}
            >
              <span>{r.emoji}</span>
              <span className="sh-reaction__count">{r.userIds.length}</span>
            </button>
          ))}
        </div>
      )}

      {/* Hover actions */}
      {showActions && (
        <div className="sh-msg__actions">
          <button
            className="sh-msg__action-btn"
            onClick={() => setShowReactionPicker(!showReactionPicker)}
            title="Tepki ekle"
          >
            😊
          </button>
          {message.replyCount > 0 && (
            <span className="sh-msg__thread-count">{message.replyCount} yanıt</span>
          )}
          {isOwnMessage && (
            <button
              className="sh-msg__action-btn sh-msg__action-btn--danger"
              onClick={() => profile && deleteMessage(channelId, message.id, profile.id)}
              title="Sil"
            >
              🗑️
            </button>
          )}
        </div>
      )}

      {/* Quick reaction picker */}
      {showReactionPicker && (
        <div className="sh-reaction-picker">
          {QUICK_REACTIONS.map((emoji) => (
            <button
              key={emoji}
              className="sh-reaction-picker__btn"
              onClick={() => {
                if (profile) reactToMessage(channelId, message.id, emoji, profile.id);
                setShowReactionPicker(false);
              }}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
