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
        <motion.div
          className="pane-empty__icon"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", damping: 12, stiffness: 200 }}
        >
          &#10003;
        </motion.div>
        <div className="pane-empty__title">All caught up!</div>
        <div className="pane-empty__desc">
          No cards are due for review right now. Check back later.
        </div>
      </div>
    );
  }

  if (!card) return null;

  const qualityButtons = [
    { q: 1, label: "Again", color: "var(--danger)", dataQ: "again" },
    { q: 2, label: "Hard", color: "var(--warning)", dataQ: "hard" },
    { q: 3, label: "Good", color: "var(--accent-2)", dataQ: "good" },
    { q: 5, label: "Easy", color: "var(--success)", dataQ: "easy" },
  ];

  const progressPct = ((currentIndex + 1) / dueCards.length) * 100;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    >
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
        <motion.div
          className="fc-progress-fill"
          initial={{ width: 0 }}
          animate={{ width: `${progressPct}%` }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>

      {/* Card with 3D flip */}
      <div className="fc-card-wrapper" onClick={() => setFlipped(!isFlipped)}>
        <AnimatePresence mode="wait">
          <motion.div
            key={isFlipped ? "back" : "front"}
            initial={{ rotateY: 90, opacity: 0, scale: 0.95 }}
            animate={{ rotateY: 0, opacity: 1, scale: 1 }}
            exit={{ rotateY: -90, opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
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
      <AnimatePresence>
        {isFlipped && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="fc-quality-group"
          >
            {qualityButtons.map(({ q, label, color, dataQ }, i) => (
              <motion.button
                key={q}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05, duration: 0.3 }}
                className="fc-quality-btn"
                data-quality={dataQ}
                style={{ background: color }}
                whileHover={{ y: -3, scale: 1.02 }}
                whileTap={{ scale: 0.95, y: 0 }}
                onClick={(e) => {
                  e.stopPropagation();
                  review(card.id, q);
                }}
              >
                {label}
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
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
        <motion.div
          initial="hidden"
          animate="show"
          variants={{
            hidden: { opacity: 0 },
            show: { opacity: 1, transition: { staggerChildren: 0.04 } },
          }}
          style={{ display: "grid", gap: 8 }}
        >
          {filtered.map((card) => (
            <motion.div
              key={card.id}
              variants={{
                hidden: { opacity: 0, y: 12 },
                show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
              }}
            >
              <div className="fc-browse-card">
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
            </motion.div>
          ))}
        </motion.div>
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
    <motion.div
      className="grid-gap-12"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
    >
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
              <motion.button
                className="btn"
                onClick={handleGenerate}
                disabled={loading}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.95 }}
              >
                {loading ? "Generating..." : "Generate Cards"}
              </motion.button>
            )}
          </div>
        </div>

        {/* Stats */}
        {stats && (
          <motion.div
            className="fc-stat-grid"
            style={{ marginBottom: 14 }}
            initial="hidden"
            animate="show"
            variants={{
              hidden: { opacity: 0 },
              show: { opacity: 1, transition: { staggerChildren: 0.06 } },
            }}
          >
            {[
              { key: "total", label: "Total", color: "var(--text)" },
              { key: "new", label: "New", color: "var(--accent-2)" },
              { key: "learning", label: "Learning", color: "var(--warning)" },
              { key: "review", label: "Review", color: "var(--accent-2)" },
              { key: "graduated", label: "Graduated", color: "var(--success)" },
              { key: "dueToday", label: "Due Today", color: "var(--danger)" },
            ].map(({ key, label, color }) => (
              <motion.div
                key={key}
                className="fc-stat-card"
                variants={{
                  hidden: { opacity: 0, y: 12, scale: 0.95 },
                  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.4 } },
                }}
                whileHover={{ y: -3, scale: 1.02 }}
              >
                <div className="fc-stat-value" style={{ color }}>
                  {(stats as unknown as Record<string, number>)[key]}
                </div>
                <div className="fc-stat-label">{label}</div>
              </motion.div>
            ))}
          </motion.div>
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

      {/* Content with transition */}
      <section className="lc-section">
        <AnimatePresence mode="wait">
          <motion.div
            key={viewMode}
            initial={{ opacity: 0, x: viewMode === "review" ? -16 : 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: viewMode === "review" ? 16 : -16 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          >
            {viewMode === "review" ? <ReviewMode /> : <BrowseMode />}
          </motion.div>
        </AnimatePresence>
      </section>
    </motion.div>
  );
}
