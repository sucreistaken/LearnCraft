import React, { useState } from "react";
import { motion } from "framer-motion";
import { useRoomStore } from "../../stores/roomStore";
import { SharedFlashcard } from "../../types";
import FlashcardRow from "./FlashcardRow";
import FlashcardForm from "./FlashcardForm";

type ViewMode = "builder" | "review";

export default function SharedFlashcardBuilder() {
  const workspace = useRoomStore((s) => s.workspace);
  const generateFlashcards = useRoomStore((s) => s.generateFlashcards);
  const identity = useRoomStore((s) => s.identity);
  const currentRoom = useRoomStore((s) => s.currentRoom);

  const [viewMode, setViewMode] = useState<ViewMode>("builder");
  const [showAddForm, setShowAddForm] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [reviewIndex, setReviewIndex] = useState(0);
  const [reviewFlipped, setReviewFlipped] = useState(false);
  const [reviewMarks, setReviewMarks] = useState<Record<string, "understood" | "repeat">>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const cards = workspace.flashcards;
  const uniqueContributors = new Set(cards.map((c) => c.createdByNickname)).size;

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await generateFlashcards();
    } finally {
      setGenerating(false);
    }
  };

  const handleStartReview = () => {
    setViewMode("review");
    setReviewIndex(0);
    setReviewFlipped(false);
    setReviewMarks({});
  };

  if (viewMode === "review") {
    return (
      <ReviewMode
        cards={cards}
        index={reviewIndex}
        flipped={reviewFlipped}
        marks={reviewMarks}
        onFlip={() => setReviewFlipped(!reviewFlipped)}
        onNext={() => {
          if (reviewIndex < cards.length - 1) {
            setReviewIndex(reviewIndex + 1);
            setReviewFlipped(false);
          } else {
            setViewMode("builder");
          }
        }}
        onMark={(cardId, mark) => setReviewMarks({ ...reviewMarks, [cardId]: mark })}
        onExit={() => setViewMode("builder")}
      />
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Header */}
      <div className="ws-pane-head">
        <div className="ws-pane-head__icon" style={{ background: "#f0fdf4", color: "#22c55e" }}>
          {"\uD83C\uDCCF"}
        </div>
        <span className="ws-pane-head__title">Flashcards</span>
        <span className="ws-pane-head__meta">
          {cards.length} cards{uniqueContributors > 0 && ` \u00B7 ${uniqueContributors} contributor${uniqueContributors !== 1 ? "s" : ""}`}
        </span>
        <div className="ws-pane-head__actions">
          <button className="btn-small" onClick={() => setShowAddForm(!showAddForm)}>+ Add Card</button>
          <motion.button
            className="btn-small"
            onClick={handleGenerate}
            disabled={generating}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {generating ? "Generating..." : "\uD83E\uDD16 AI Generate"}
          </motion.button>
          {cards.length > 0 && (
            <button className="btn-small" onClick={handleStartReview}>
              {"\uD83D\uDCD6"} Review
            </button>
          )}
        </div>
      </div>

      {/* Inline add form */}
      {showAddForm && (
        <FlashcardForm onClose={() => setShowAddForm(false)} />
      )}

      {/* List header */}
      {cards.length > 0 && (
        <div className="ws-fc-list-header">
          <span className="ws-fc-row__topic">Topic</span>
          <span className="ws-fc-row__front">Question</span>
          <span className="ws-fc-row__back">Answer</span>
          <span className="ws-fc-row__author">Author</span>
          <span className="ws-fc-row__votes">Votes</span>
          <span className="ws-fc-row__actions" />
        </div>
      )}

      {/* Card list */}
      <div className="ws-fc-grid" style={{ flex: 1, overflowY: "auto" }}>
        {cards.length === 0 && !showAddForm && (
          <div>
            <div className="pane-empty">
              <div className="pane-empty__icon">{"\uD83C\uDCCF"}</div>
              <div className="pane-empty__title">No flashcards yet</div>
              <div className="pane-empty__desc">
                Add cards manually or let AI generate them from {currentRoom?.lessonTitle || "the lesson"}.
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 16 }}>
                <button className="btn btn-primary" onClick={() => setShowAddForm(true)}>+ Add Card</button>
                <button className="btn btn-secondary" onClick={handleGenerate} disabled={generating}>
                  {generating ? "Generating..." : "\uD83E\uDD16 AI Generate"}
                </button>
              </div>
            </div>
          </div>
        )}

        {cards.map((card) => (
          <FlashcardRow
            key={card.id}
            card={card}
            expanded={expandedId === card.id}
            onToggle={() => setExpandedId(expandedId === card.id ? null : card.id)}
            currentUserId={identity?.id || ""}
          />
        ))}
      </div>
    </div>
  );
}

// ======== Review Mode ========

function ReviewMode({
  cards,
  index,
  flipped,
  marks,
  onFlip,
  onNext,
  onMark,
  onExit,
}: {
  cards: SharedFlashcard[];
  index: number;
  flipped: boolean;
  marks: Record<string, "understood" | "repeat">;
  onFlip: () => void;
  onNext: () => void;
  onMark: (cardId: string, mark: "understood" | "repeat") => void;
  onExit: () => void;
}) {
  const card = cards[index];
  const isLast = index === cards.length - 1;
  const understoodCount = Object.values(marks).filter((m) => m === "understood").length;
  const repeatCount = Object.values(marks).filter((m) => m === "repeat").length;

  if (!card) {
    return (
      <div className="pane-empty">
        <div className="pane-empty__title">Review Complete!</div>
        <div className="pane-empty__desc">
          {understoodCount} understood, {repeatCount} need review
        </div>
        <button className="btn btn-primary" onClick={onExit} style={{ marginTop: 16 }}>Back to Builder</button>
      </div>
    );
  }

  return (
    <div className="ws-review">
      <div className="ws-pane-head">
        <span className="ws-pane-head__title">Review Mode</span>
        <span className="ws-pane-head__meta">{index + 1} / {cards.length}</span>
        <div className="ws-pane-head__actions">
          <span className="status-badge status-badge--success">{understoodCount} understood</span>
          <span className="status-badge status-badge--warning">{repeatCount} repeat</span>
          <button className="btn-small" onClick={onExit}>Exit Review</button>
        </div>
      </div>

      <div className="ws-review__progress">
        <div className="ws-review__progress-fill" style={{ width: `${((index + 1) / cards.length) * 100}%` }} />
      </div>

      <div className="ws-review__body">
        <motion.div
          key={`${card.id}-${flipped}`}
          className={`ws-review__card${flipped ? " ws-review__card--back" : ""}`}
          onClick={onFlip}
          initial={{ rotateY: 90, opacity: 0 }}
          animate={{ rotateY: 0, opacity: 1 }}
          transition={{ duration: 0.2 }}
        >
          <div className="ws-review__card-label">{flipped ? "Answer" : "Question"}</div>
          <div className="ws-review__card-body">{flipped ? card.back : card.front}</div>
          {card.topicName && (
            <div className="ws-review__card-meta">Topic: {card.topicName}</div>
          )}
          <div className="ws-review__card-meta">
            by {card.createdByNickname} {card.source === "ai-generated" && "(\uD83E\uDD16 AI)"}
          </div>
        </motion.div>

        {!flipped && (
          <p className="ws-pane-head__meta" style={{ marginTop: 8 }}>Click card to flip</p>
        )}

        {flipped && (
          <div className="ws-review__actions">
            <motion.button
              className="btn btn-secondary"
              onClick={() => { onMark(card.id, "repeat"); onNext(); }}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              style={{ minWidth: 120 }}
            >
              {"\uD83D\uDD01"} Repeat
            </motion.button>
            <motion.button
              className="btn btn-primary"
              onClick={() => { onMark(card.id, "understood"); onNext(); }}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              style={{ minWidth: 120 }}
            >
              {"\u2705"} {isLast ? "Finish" : "Got it!"}
            </motion.button>
          </div>
        )}
      </div>
    </div>
  );
}
