import React, { useState } from "react";
import { motion } from "framer-motion";
import { useRoomStore } from "../../stores/roomStore";
import { SharedFlashcard } from "../../types";

export default function FlashcardCard({ card, currentUserId }: { card: SharedFlashcard; currentUserId: string }) {
  const [flipped, setFlipped] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editFront, setEditFront] = useState(card.front);
  const [editBack, setEditBack] = useState(card.back);

  const voteFlashcard = useRoomStore((s) => s.voteFlashcard);
  const editFlashcard = useRoomStore((s) => s.editFlashcard);
  const deleteFlashcard = useRoomStore((s) => s.deleteFlashcard);
  const currentRoom = useRoomStore((s) => s.currentRoom);

  const upVotes = card.votes.filter((v) => v.vote === "up").length;
  const downVotes = card.votes.filter((v) => v.vote === "down").length;
  const userVote = card.votes.find((v) => v.userId === currentUserId)?.vote;
  const canDelete = card.createdBy === currentUserId || currentRoom?.hostId === currentUserId;
  const isLowQuality = downVotes >= 2 && downVotes > upVotes;

  const handleSaveEdit = () => {
    editFlashcard(card.id, editFront, editBack);
    setEditing(false);
  };

  if (editing) {
    return (
      <motion.div
        layout
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="ws-fc-form"
      >
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
      </motion.div>
    );
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={`ws-fc-card${flipped ? " ws-fc-card--flipped" : ""}${isLowQuality ? " ws-fc-card--dim" : ""}`}
      onClick={() => setFlipped(!flipped)}
    >
      {card.topicName && (
        <div className="ws-fc-card__topic">{card.topicName}</div>
      )}

      <div className="ws-fc-card__body">
        {flipped ? card.back : card.front}
      </div>

      <div className="ws-fc-card__footer">
        <div className="ws-fc-card__author">
          {card.source === "ai-generated" ? "\uD83E\uDD16" : "\uD83D\uDC64"}
          <span>{card.createdByNickname}</span>
        </div>

        <div className="ws-fc-card__votes" onClick={(e) => e.stopPropagation()}>
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
        </div>

        <div className="ws-fc-card__actions" onClick={(e) => e.stopPropagation()}>
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
        </div>
      </div>

      <div className="ws-fc-card__flip-hint">
        {flipped ? "showing answer \u2013 click to flip" : "click to flip"}
      </div>
    </motion.div>
  );
}
