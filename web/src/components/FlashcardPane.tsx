import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useFlashcardStore } from "../stores/flashcardStore";
import { useLessonStore } from "../stores/lessonStore";
import { useRoomStore } from "../stores/roomStore";

function ReviewMode() {
  const { dueCards, currentIndex, isFlipped, setFlipped, review, fetchDue } = useFlashcardStore();
  const card = dueCards[currentIndex];

  useEffect(() => {
    fetchDue();
  }, []);

  if (!dueCards.length) {
    return (
      <div className="pane-empty">
        <div className="pane-empty__icon">&#10003;</div>
        <div className="pane-empty__title">All caught up!</div>
        <div className="pane-empty__desc">
          No cards are due for review right now. Check back later.
        </div>
      </div>
    );
  }

  if (!card) return null;

  const qualityButtons = [
    { q: 1, label: "Again", color: "var(--danger)" },
    { q: 2, label: "Hard", color: "var(--warning)" },
    { q: 3, label: "Good", color: "var(--accent-2)" },
    { q: 5, label: "Easy", color: "var(--success)" },
  ];

  const progressPct = ((currentIndex + 1) / dueCards.length) * 100;

  return (
    <div>
      {/* Progress */}
      <div className="fc-progress-label">
        <span className="small" style={{ color: "var(--muted)" }}>
          Card {currentIndex + 1} of {dueCards.length}
        </span>
        <span className="small" style={{ color: "var(--muted)" }}>
          {card.topicName}
        </span>
      </div>
      <div className="fc-progress-track">
        <div className="fc-progress-fill" style={{ width: `${progressPct}%` }} />
      </div>

      {/* Card */}
      <div className="fc-card-wrapper" onClick={() => setFlipped(!isFlipped)}>
        <AnimatePresence mode="wait">
          <motion.div
            key={isFlipped ? "back" : "front"}
            initial={{ rotateY: 90, opacity: 0 }}
            animate={{ rotateY: 0, opacity: 1 }}
            exit={{ rotateY: -90, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className={`fc-card${isFlipped ? " fc-card--back" : ""}`}
          >
            <div className="fc-card__label">
              {isFlipped ? "ANSWER" : "QUESTION"} — tap to flip
            </div>
            <div className="fc-card__content">
              {isFlipped ? card.back : card.front}
            </div>
            <div className="fc-card__meta">
              <span>{card.source}</span>
              <span className="fc-card__meta-sep" />
              <span>{card.state}</span>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Rating Buttons */}
      {isFlipped && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="fc-quality-group"
        >
          {qualityButtons.map(({ q, label, color }) => (
            <button
              key={q}
              className="fc-quality-btn"
              style={{ background: color }}
              onClick={(e) => {
                e.stopPropagation();
                review(card.id, q);
              }}
            >
              {label}
            </button>
          ))}
        </motion.div>
      )}
    </div>
  );
}

function BrowseMode() {
  const { cards, fetchAll, deleteCard, loading } = useFlashcardStore();
  const currentLessonId = useLessonStore((s) => s.currentLessonId);
  const currentRoom = useRoomStore((s) => s.currentRoom);
  const addFlashcard = useRoomStore((s) => s.addFlashcard);
  const [filter, setFilter] = useState<string>("all");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetchAll(currentLessonId || undefined);
  }, [currentLessonId]);

  const filtered = filter === "all" ? cards : cards.filter((c) => c.state === filter);

  const stateStyle: Record<string, string> = {
    new: "status-badge--info",
    learning: "status-badge--warning",
    review: "status-badge--info",
    graduated: "status-badge--success",
  };

  const handleSendToRoom = async () => {
    if (!currentRoom || !filtered.length) return;
    setSending(true);
    for (const card of filtered) {
      addFlashcard(card.front, card.back, card.topicName);
    }
    setSending(false);
  };

  return (
    <div>
      {/* Filters */}
      <div className="view-toggle" style={{ marginBottom: 14, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        {["all", "new", "learning", "review", "graduated"].map((f) => (
          <button
            key={f}
            className={`view-toggle__btn${filter === f ? " view-toggle__btn--active" : ""}`}
            onClick={() => setFilter(f)}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
            {f !== "all" ? ` (${cards.filter((c) => c.state === f).length})` : ""}
          </button>
        ))}
        {currentRoom && filtered.length > 0 && (
          <button
            className="btn btn-secondary"
            style={{ marginLeft: "auto", fontSize: 12, padding: "5px 12px" }}
            onClick={handleSendToRoom}
            disabled={sending}
          >
            {sending ? "Sending..." : `Send ${filtered.length} to Room`}
          </button>
        )}
      </div>

      {/* Cards Grid */}
      {loading ? (
        <div className="pane-empty" style={{ padding: 24 }}>
          <div className="pane-empty__desc">Loading cards...</div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="pane-empty">
          <div className="pane-empty__icon">F</div>
          <div className="pane-empty__title">No cards found</div>
          <div className="pane-empty__desc">
            Generate flashcards from a lesson first.
          </div>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {filtered.map((card) => (
            <div key={card.id} className="fc-browse-card">
              <div className="fc-browse-header">
                <span className={`status-badge ${stateStyle[card.state] || "status-badge--muted"}`}>
                  {card.state}
                </span>
                <button className="fc-delete-btn" onClick={() => deleteCard(card.id)}>
                  Delete
                </button>
              </div>
              <div className="fc-browse-front">{card.front}</div>
              <div className="fc-browse-back">{card.back}</div>
              <div className="fc-browse-meta">
                <span>{card.topicName}</span>
                <span className="fc-card__meta-sep" />
                <span>EF: {card.easeFactor.toFixed(2)}</span>
                <span className="fc-card__meta-sep" />
                <span>Interval: {card.interval}d</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function FlashcardPane() {
  const { stats, fetchStats, viewMode, setViewMode, generate, loading } = useFlashcardStore();
  const currentLessonId = useLessonStore((s) => s.currentLessonId);

  useEffect(() => {
    fetchStats();
  }, []);

  const handleGenerate = async () => {
    if (!currentLessonId) return;
    await generate(currentLessonId);
  };

  return (
    <div className="grid-gap-12">
      {/* Header */}
      <section className="lc-section">
        <div className="pane-header" style={{ marginBottom: 14 }}>
          <div className="pane-header__info">
            <div className="pane-header__title">Flashcards</div>
            <div className="pane-header__desc">
              Spaced repetition powered by SM-2 algorithm.
            </div>
          </div>
          <div className="pane-header__actions">
            {currentLessonId && (
              <button className="btn" onClick={handleGenerate} disabled={loading}>
                {loading ? "Generating..." : "Generate Cards"}
              </button>
            )}
          </div>
        </div>

        {/* Stats */}
        {stats && (
          <div className="fc-stat-grid" style={{ marginBottom: 14 }}>
            <div className="fc-stat-card">
              <div className="fc-stat-value" style={{ color: "var(--text)" }}>{stats.total}</div>
              <div className="fc-stat-label">Total</div>
            </div>
            <div className="fc-stat-card">
              <div className="fc-stat-value" style={{ color: "var(--accent-2)" }}>{stats.new}</div>
              <div className="fc-stat-label">New</div>
            </div>
            <div className="fc-stat-card">
              <div className="fc-stat-value" style={{ color: "var(--warning)" }}>{stats.learning}</div>
              <div className="fc-stat-label">Learning</div>
            </div>
            <div className="fc-stat-card">
              <div className="fc-stat-value" style={{ color: "var(--accent-2)" }}>{stats.review}</div>
              <div className="fc-stat-label">Review</div>
            </div>
            <div className="fc-stat-card">
              <div className="fc-stat-value" style={{ color: "var(--success)" }}>{stats.graduated}</div>
              <div className="fc-stat-label">Graduated</div>
            </div>
            <div className="fc-stat-card">
              <div className="fc-stat-value" style={{ color: "var(--danger)" }}>{stats.dueToday}</div>
              <div className="fc-stat-label">Due Today</div>
            </div>
          </div>
        )}

        {/* View Toggle */}
        <div className="view-toggle">
          <button
            className={`view-toggle__btn${viewMode === "review" ? " view-toggle__btn--active" : ""}`}
            onClick={() => setViewMode("review")}
          >
            Review Mode
          </button>
          <button
            className={`view-toggle__btn${viewMode === "browse" ? " view-toggle__btn--active" : ""}`}
            onClick={() => setViewMode("browse")}
          >
            Browse All
          </button>
        </div>
      </section>

      {/* Content */}
      <section className="lc-section">
        {viewMode === "review" ? <ReviewMode /> : <BrowseMode />}
      </section>
    </div>
  );
}
