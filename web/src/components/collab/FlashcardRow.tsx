import React, { useState } from "react";
import { useRoomStore } from "../../stores/roomStore";
import { useLessonStore } from "../../stores/lessonStore";
import { flashcardApi } from "../../services/api";
import { SharedFlashcard } from "../../types";

export default function FlashcardRow({
  card,
  expanded,
  onToggle,
  currentUserId,
}: {
  card: SharedFlashcard;
  expanded: boolean;
  onToggle: () => void;
  currentUserId: string;
}) {
  const voteFlashcard = useRoomStore((s) => s.voteFlashcard);
  const editFlashcard = useRoomStore((s) => s.editFlashcard);
  const deleteFlashcard = useRoomStore((s) => s.deleteFlashcard);
  const currentRoom = useRoomStore((s) => s.currentRoom);
  const currentLessonId = useLessonStore((s) => s.currentLessonId);

  const [editing, setEditing] = useState(false);
  const [editFront, setEditFront] = useState(card.front);
  const [editBack, setEditBack] = useState(card.back);
  const [saved, setSaved] = useState(false);

  const handleSavePersonal = async () => {
    if (!currentLessonId) return;
    const res = await flashcardApi.create(currentLessonId, card.front, card.back, card.topicName || "");
    if (res.ok) setSaved(true);
  };

  const upVotes = card.votes.filter((v) => v.vote === "up").length;
  const downVotes = card.votes.filter((v) => v.vote === "down").length;
  const userVote = card.votes.find((v) => v.userId === currentUserId)?.vote;
  const canDelete = card.createdBy === currentUserId || currentRoom?.hostId === currentUserId;

  const handleSaveEdit = () => {
    editFlashcard(card.id, editFront, editBack);
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="ws-fc-row__expanded-back" style={{ display: "flex", flexDirection: "column", gap: 8, padding: "12px 18px" }}>
        <input
          className="lc-textarea input"
          value={editFront}
          onChange={(e) => setEditFront(e.target.value)}
          placeholder="Front (question)"
          autoFocus
        />
        <textarea
          className="lc-textarea input"
          value={editBack}
          onChange={(e) => setEditBack(e.target.value)}
          placeholder="Back (answer)"
          rows={3}
          style={{ resize: "vertical" }}
        />
        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
          <button className="btn-small" onClick={() => setEditing(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSaveEdit} style={{ padding: "5px 14px", fontSize: 12 }}>Save</button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className={`ws-fc-row${expanded ? " ws-fc-row--expanded" : ""}`} onClick={onToggle}>
        <span className="ws-fc-row__topic">{card.topicName || "General"}</span>
        <span className="ws-fc-row__front">{card.front}</span>
        <span className="ws-fc-row__back">{card.back}</span>
        <span className="ws-fc-row__author">
          <span
            className="ws-fc-row__author-avatar"
            style={{ background: card.source === "ai-generated" ? "#8b5cf6" : "#3b82f6" }}
          >
            {card.source === "ai-generated" ? "\uD83E\uDD16" : card.createdByNickname.charAt(0).toUpperCase()}
          </span>
          {card.createdByNickname}
        </span>
        <span className="ws-fc-row__votes" onClick={(e) => e.stopPropagation()}>
          <button
            className={`ws-fc-vote${userVote === "up" ? " ws-fc-vote--up-active" : ""}`}
            onClick={() => voteFlashcard(card.id, "up")}
          >
            {"\uD83D\uDC4D"}{upVotes > 0 && ` ${upVotes}`}
          </button>
          <button
            className={`ws-fc-vote${userVote === "down" ? " ws-fc-vote--down-active" : ""}`}
            onClick={() => voteFlashcard(card.id, "down")}
          >
            {"\uD83D\uDC4E"}{downVotes > 0 && ` ${downVotes}`}
          </button>
        </span>
        <span className="ws-fc-row__actions" onClick={(e) => e.stopPropagation()}>
          <button
            className="ws-fc-card__action-btn"
            onClick={handleSavePersonal}
            title={saved ? "Saved!" : "Save to personal"}
            disabled={saved || !currentLessonId}
            style={saved ? { opacity: 0.5 } : undefined}
          >
            {saved ? "\u2705" : "\uD83D\uDCBE"}
          </button>
          <button
            className="ws-fc-card__action-btn"
            onClick={() => { setEditFront(card.front); setEditBack(card.back); setEditing(true); }}
            title="Edit"
          >
            {"\u270F\uFE0F"}
          </button>
          {canDelete && (
            <button
              className="ws-fc-card__action-btn ws-fc-card__action-btn--danger"
              onClick={() => deleteFlashcard(card.id)}
              title="Delete"
            >
              {"\u2715"}
            </button>
          )}
        </span>
      </div>
      {expanded && (
        <div className="ws-fc-row__expanded-back">
          <strong>Answer:</strong> {card.back}
        </div>
      )}
    </>
  );
}
