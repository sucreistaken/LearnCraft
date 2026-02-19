import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { useChannelToolStore } from "../../../stores/channelToolStore";
import { channelToolApi } from "../../../services/channelToolApi";
import { getCollabSocket } from "../../../services/collabSocket";
import type { ChannelFlashcardItem, LessonContextInfo, ExtractionSummary } from "../../../types";

interface Props {
  channelId: string;
  topic: string;
  serverName: string;
  userId: string;
  nickname: string;
  lessonContext?: LessonContextInfo | null;
}

const EMPTY_CARDS: ChannelFlashcardItem[] = [];

type Mode = "grid" | "review" | "sm2-review";

// SM-2 quality labels
const SM2_RATINGS = [
  { quality: 0, label: "Tekrar", desc: "Hi\u00E7 hat\u0131rlamad\u0131m", color: "var(--danger)" },
  { quality: 1, label: "Zor", desc: "\u00C7ok zorland\u0131m", color: "#e67e22" },
  { quality: 2, label: "Orta", desc: "Biraz hat\u0131rlad\u0131m", color: "#f39c12" },
  { quality: 3, label: "\u0130yi", desc: "Do\u011Fru hat\u0131rlad\u0131m", color: "#27ae60" },
  { quality: 4, label: "Kolay", desc: "Kolayca hat\u0131rlad\u0131m", color: "#2ecc71" },
  { quality: 5, label: "M\u00FCkemmel", desc: "An\u0131nda bildim", color: "var(--accent-2)" },
];

const SOURCE_LABELS: Record<string, string> = {
  "lesson-emphasis": "Emphasis",
  "lesson-cheatsheet": "Cheat Sheet",
  "lesson-miniQuiz": "Mini Quiz",
  "lesson-loModule": "Key Fact",
  "ai-generated": "AI",
  manual: "Manual",
};

function isDueForReview(card: ChannelFlashcardItem, userId: string): boolean {
  const sm2 = card.sm2?.[userId];
  if (!sm2) return true; // Never reviewed = due
  return new Date(sm2.nextReview) <= new Date();
}

function getDaysUntilReview(card: ChannelFlashcardItem, userId: string): number | null {
  const sm2 = card.sm2?.[userId];
  if (!sm2) return null;
  const diff = new Date(sm2.nextReview).getTime() - Date.now();
  return Math.ceil(diff / (24 * 60 * 60 * 1000));
}

export default function ChannelFlashcards({ channelId, topic, serverName, userId, nickname, lessonContext }: Props) {
  const cards = useChannelToolStore(s => s.dataByChannel[channelId]?.flashcards?.cards ?? EMPTY_CARDS);
  const addFlashcardToStore = useChannelToolStore(s => s.addFlashcardToStore);
  const loadToolData = useChannelToolStore(s => s.loadToolData);

  const [mode, setMode] = useState<Mode>("grid");
  const [showAddForm, setShowAddForm] = useState(false);
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [cardTopic, setCardTopic] = useState("");
  const [reviewIndex, setReviewIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [revealedCards, setRevealedCards] = useState<Set<string>>(new Set());
  const [extractionResult, setExtractionResult] = useState<ExtractionSummary | null>(null);

  // Cards due for SM-2 review
  const dueCards = useMemo(
    () => cards.filter(c => isDueForReview(c, userId)),
    [cards, userId]
  );

  // Stats
  const reviewedCount = useMemo(
    () => cards.filter(c => c.sm2?.[userId]).length,
    [cards, userId]
  );

  const hasLesson = !!lessonContext?.linked;

  function toggleReveal(cardId: string) {
    setRevealedCards(prev => {
      const next = new Set(prev);
      if (next.has(cardId)) next.delete(cardId);
      else next.add(cardId);
      return next;
    });
  }

  function getVoteScore(card: ChannelFlashcardItem): number {
    return card.votes.reduce((sum, v) => sum + (v.vote === "up" ? 1 : -1), 0);
  }

  function getUserVote(card: ChannelFlashcardItem): "up" | "down" | null {
    return card.votes.find(v => v.userId === userId)?.vote ?? null;
  }

  function handleVote(card: ChannelFlashcardItem, vote: "up" | "down") {
    const currentVote = getUserVote(card);
    const newVote = currentVote === vote ? null : vote;
    const updatedVotes = card.votes.filter(v => v.userId !== userId);
    if (newVote) updatedVotes.push({ userId, vote: newVote });

    const store = useChannelToolStore.getState();
    const existing = store.dataByChannel[channelId];
    if (existing?.flashcards) {
      const updatedCards = existing.flashcards.cards.map(c =>
        c.id === card.id ? { ...c, votes: updatedVotes } : c
      );
      store.setToolData(channelId, {
        ...existing,
        flashcards: { cards: updatedCards },
      });
    }
  }

  async function handleAddCard(e: React.FormEvent) {
    e.preventDefault();
    if (!front.trim() || !back.trim()) return;
    try {
      const { card } = await channelToolApi.addFlashcard(
        channelId, front.trim(), back.trim(), cardTopic.trim() || topic, userId, nickname
      );
      addFlashcardToStore(channelId, card);
      getCollabSocket().emit("tool:flashcard:add", { channelId, card });
      setFront(""); setBack(""); setCardTopic(""); setShowAddForm(false);
    } catch (err) {
      console.error("Failed to add flashcard:", err);
    }
  }

  async function handleGenerate() {
    if (generating) return;
    setGenerating(true);
    try {
      await channelToolApi.generateFlashcards(channelId, topic, serverName);
      await loadToolData(channelId);
      getCollabSocket().emit("tool:data:update", { channelId });
    } catch (err) {
      console.error("Failed to generate flashcards:", err);
    } finally {
      setGenerating(false);
    }
  }

  async function handleExtract() {
    if (extracting || !hasLesson) return;
    setExtracting(true);
    setExtractionResult(null);
    try {
      const { summary } = await channelToolApi.extractFlashcardsFromLesson(channelId);
      setExtractionResult(summary);
      await loadToolData(channelId);
      getCollabSocket().emit("tool:data:update", { channelId });
    } catch (err) {
      console.error("Failed to extract flashcards:", err);
    } finally {
      setExtracting(false);
    }
  }

  // SM-2 review rating
  async function handleSm2Rating(quality: number) {
    const reviewCards = mode === "sm2-review" ? dueCards : cards;
    const currentCard = reviewCards[reviewIndex];
    if (!currentCard || reviewing) return;

    setReviewing(true);
    try {
      const { card: updatedCard } = await channelToolApi.reviewFlashcard(
        channelId, currentCard.id, userId, quality
      );
      // Update store
      const store = useChannelToolStore.getState();
      const existing = store.dataByChannel[channelId];
      if (existing?.flashcards) {
        const updatedCards = existing.flashcards.cards.map(c =>
          c.id === updatedCard.id ? updatedCard : c
        );
        store.setToolData(channelId, {
          ...existing,
          flashcards: { cards: updatedCards },
        });
      }

      // Move to next card or finish
      if (reviewIndex < reviewCards.length - 1) {
        setReviewIndex(reviewIndex + 1);
        setFlipped(false);
        setShowHint(false);
      } else {
        // End of deck
        setMode("grid");
        setReviewIndex(0);
        setFlipped(false);
        setShowHint(false);
      }
    } catch (err) {
      console.error("Failed to review flashcard:", err);
    } finally {
      setReviewing(false);
    }
  }

  function startReview(reviewMode: Mode) {
    setMode(reviewMode);
    setReviewIndex(0);
    setFlipped(false);
    setShowHint(false);
  }

  function getSourceTag(source: string): string | null {
    return SOURCE_LABELS[source] || null;
  }

  // Helper: compute stat percentages for visual rings
  const totalCards = cards.length;
  const duePercent = totalCards > 0 ? (dueCards.length / totalCards) * 100 : 0;
  const reviewedPercent = totalCards > 0 ? (reviewedCount / totalCards) * 100 : 0;
  const masteredCount = totalCards - dueCards.length;
  const masteredPercent = totalCards > 0 ? (masteredCount / totalCards) * 100 : 0;

  // Mini SVG ring component (inline to avoid extra file)
  function StatRing({ percent, color, size = 36, strokeWidth = 3.5 }: { percent: number; color: string; size?: number; strokeWidth?: number }) {
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (percent / 100) * circumference;
    return (
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)", flexShrink: 0 }}>
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none"
          stroke="var(--border)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.5s ease" }}
        />
      </svg>
    );
  }

  // ── Empty state ──
  if (cards.length === 0 && !showAddForm) {
    return (
      <div className="sh-tool">
        {/* Header with gradient icon */}
        <div className="sh-tool__header sh-fc__header--gradient">
          <div className="sh-tool__header-left">
            <div className="sh-fc__header-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <path d="M2 10h20" />
              </svg>
            </div>
            <h3 className="sh-main-content__channel-name">Flashcards - {topic}</h3>
          </div>
        </div>
        <div className="sh-tool__body">
          <div className="sh-tool__empty sh-fc__empty--enhanced">
            {/* Large illustration icon */}
            <div className="sh-fc__empty-illustration">
              <svg width="72" height="72" viewBox="0 0 72 72" fill="none">
                {/* Back card */}
                <rect x="14" y="10" width="44" height="32" rx="6" fill="var(--border)" opacity="0.5" />
                {/* Middle card */}
                <rect x="10" y="16" width="44" height="32" rx="6" fill="var(--card)" stroke="var(--border)" strokeWidth="1.5" />
                {/* Front card */}
                <rect x="18" y="24" width="44" height="32" rx="6" fill="var(--card)" stroke="var(--accent-2)" strokeWidth="2" />
                {/* Sparkle */}
                <circle cx="56" cy="20" r="3" fill="var(--accent-2)" opacity="0.7" />
                <circle cx="60" cy="14" r="1.5" fill="var(--accent-2)" opacity="0.4" />
                {/* Question mark on front card */}
                <text x="40" y="45" textAnchor="middle" fontSize="16" fontWeight="bold" fill="var(--accent-2)">?</text>
              </svg>
            </div>
            <h3 className="sh-tool__empty-title" style={{ fontSize: "var(--text-lg)", marginTop: "var(--space-3)" }}>
              Hen{"\u00FC"}z kart yok
            </h3>
            <p className="sh-tool__empty-desc" style={{ maxWidth: 360, margin: "var(--space-2) auto var(--space-5)" }}>
              AI ile <strong>"{topic}"</strong> konusunda kartlar olu{"\u015F"}turun veya kendiniz ekleyin!
            </p>
            <div className="sh-fc__empty-actions">
              <button className="sh-fc__cta-btn sh-fc__cta-btn--primary" onClick={handleGenerate} disabled={generating}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
                </svg>
                {generating ? "Olu\u015Fturuluyor..." : "AI ile Olu\u015Ftur"}
              </button>
              {hasLesson && (
                <button className="sh-fc__cta-btn sh-fc__cta-btn--extract" onClick={handleExtract} disabled={extracting}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                  </svg>
                  {extracting ? "\u00C7\u0131kar\u0131l\u0131yor..." : "Dersten \u00C7\u0131kar"}
                </button>
              )}
              <button className="sh-fc__cta-btn sh-fc__cta-btn--ghost" onClick={() => setShowAddForm(true)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Kart Ekle
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Review mode (classic flip + SM-2 rating) ──
  if ((mode === "review" || mode === "sm2-review") && cards.length > 0) {
    const reviewCards = mode === "sm2-review" ? dueCards : cards;

    if (reviewCards.length === 0) {
      return (
        <div className="sh-tool">
          <div className="sh-tool__header sh-fc__header--gradient">
            <div className="sh-tool__header-left">
              <div className="sh-fc__header-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="4" width="20" height="16" rx="2" />
                  <path d="M2 10h20" />
                </svg>
              </div>
              <h3 className="sh-main-content__channel-name">Flashcards - {topic}</h3>
            </div>
            <div className="sh-tool__header-right">
              <button className="lc-btn lc-btn--ghost lc-btn--sm" onClick={() => setMode("grid")}>
                Kartlara D{"\u00F6"}n
              </button>
            </div>
          </div>
          <div className="sh-tool__body">
            <div className="sh-tool__empty sh-fc__empty--enhanced">
              <div className="sh-fc__empty-illustration">
                <svg width="72" height="72" viewBox="0 0 72 72" fill="none">
                  <circle cx="36" cy="36" r="28" fill="none" stroke="var(--accent-2)" strokeWidth="3" opacity="0.2" />
                  <circle cx="36" cy="36" r="28" fill="none" stroke="var(--accent-2)" strokeWidth="3" strokeDasharray="176" strokeDashoffset="0" strokeLinecap="round" />
                  <path d="M26 36L33 43L46 28" stroke="var(--accent-2)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <h3 className="sh-tool__empty-title" style={{ fontSize: "var(--text-lg)", marginTop: "var(--space-3)" }}>
                T{"\u00FC"}m kartlar tekrarland{"\u0131"}!
              </h3>
              <p className="sh-tool__empty-desc" style={{ maxWidth: 320 }}>
                Bug{"\u00FC"}n i{"\u00E7"}in tekrarlanacak kart kalmad{"\u0131"}. Yar{"\u0131"}n tekrar gel!
              </p>
            </div>
          </div>
        </div>
      );
    }

    const safeIndex = Math.min(reviewIndex, reviewCards.length - 1);
    const reviewCard = reviewCards[safeIndex];

    return (
      <div className="sh-tool">
        <div className="sh-tool__header sh-fc__header--gradient">
          <div className="sh-tool__header-left">
            <div className="sh-fc__header-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <path d="M2 10h20" />
              </svg>
            </div>
            <h3 className="sh-main-content__channel-name">
              {mode === "sm2-review" ? "Tekrar Modu" : "G\u00F6zden Ge\u00E7ir"} - {topic}
            </h3>
            <span className="sh-fc__counter-pill">
              {safeIndex + 1} / {reviewCards.length}
            </span>
          </div>
          <div className="sh-tool__header-right">
            <button className="lc-btn lc-btn--ghost lc-btn--sm" onClick={() => { setMode("grid"); setFlipped(false); setShowHint(false); }}>
              Kartlara D{"\u00F6"}n
            </button>
          </div>
        </div>

        <div className="sh-tool__body">
          {reviewCard && (
            <div className="sh-fc__review">
              {/* Progress bar */}
              <div className="sh-fc__progress-bar">
                <div
                  className="sh-fc__progress-fill"
                  style={{ width: `${((safeIndex + 1) / reviewCards.length) * 100}%` }}
                />
              </div>

              {/* Flip card with 3D perspective */}
              <div className="sh-fc__review-perspective">
                <motion.div
                  className={`sh-fc__review-card sh-fc__review-card--3d${flipped ? " sh-fc__review-card--flipped" : ""}`}
                  animate={{ rotateY: flipped ? 180 : 0 }}
                  transition={{ type: "spring", stiffness: 300, damping: 25 }}
                  style={{ transformStyle: "preserve-3d" }}
                  onClick={() => setFlipped(prev => !prev)}
                >
                  {flipped ? (
                    <div className="sh-fc__review-back">
                      <span className="sh-fc__review-label">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: "-2px", marginRight: 4 }}>
                          <circle cx="12" cy="12" r="10" />
                          <path d="M12 16v-4" />
                          <path d="M12 8h.01" />
                        </svg>
                        Cevap
                      </span>
                      <p>{reviewCard.back}</p>
                    </div>
                  ) : (
                    <div className="sh-fc__review-front">
                      <span className="sh-fc__review-label">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: "-2px", marginRight: 4 }}>
                          <circle cx="12" cy="12" r="10" />
                          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                          <path d="M12 17h.01" />
                        </svg>
                        Soru
                      </span>
                      <p>{reviewCard.front}</p>
                      {/* Subtle flip cue */}
                      <div className="sh-fc__flip-cue">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="23 4 23 10 17 10" />
                          <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                        </svg>
                        <span>T{"\u0131"}kla ve {"\u00E7"}evir</span>
                      </div>
                    </div>
                  )}
                </motion.div>
              </div>

              {/* Hint (only before flip) */}
              {!flipped && reviewCard.hint && (
                <div className="sh-fc__hint-area">
                  {showHint ? (
                    <p className="sh-fc__hint-text">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: "-2px", marginRight: 4 }}>
                        <line x1="9" y1="18" x2="15" y2="18" />
                        <line x1="10" y1="22" x2="14" y2="22" />
                        <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14" />
                      </svg>
                      {reviewCard.hint}
                    </p>
                  ) : (
                    <button
                      className="sh-fc__hint-btn"
                      onClick={(e) => { e.stopPropagation(); setShowHint(true); }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="9" y1="18" x2="15" y2="18" />
                        <line x1="10" y1="22" x2="14" y2="22" />
                        <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14" />
                      </svg>
                      {"\u0130"}pucu G{"\u00F6"}ster
                    </button>
                  )}
                </div>
              )}

              {/* Before flip hint */}
              {!flipped && !reviewCard.hint && (
                <p className="sh-fc__review-hint">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: "-2px", marginRight: 4 }}>
                    <polyline points="23 4 23 10 17 10" />
                    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                  </svg>
                  Kart{"\u0131"} {"\u00E7"}evirmek i{"\u00E7"}in t{"\u0131"}klay{"\u0131"}n
                </p>
              )}

              {/* SM-2 rating buttons (show after flip) */}
              {flipped && (
                <div className="sh-fc__sm2-ratings">
                  <p className="sh-fc__sm2-prompt">Ne kadar hat{"\u0131"}rlad{"\u0131"}n{"\u0131"}z?</p>
                  <div className="sh-fc__sm2-buttons sh-fc__sm2-buttons--large">
                    {SM2_RATINGS.map(r => (
                      <button
                        key={r.quality}
                        className={`sh-fc__sm2-btn sh-fc__sm2-btn--lg sh-fc__sm2-btn--q${r.quality}`}
                        style={{ "--sm2-color": r.color } as React.CSSProperties}
                        onClick={(e) => { e.stopPropagation(); handleSm2Rating(r.quality); }}
                        disabled={reviewing}
                        title={r.desc}
                      >
                        <span className="sh-fc__sm2-btn-label">{r.label}</span>
                        <span className="sh-fc__sm2-btn-desc">{r.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Simple nav for non-SM2 mode */}
              {!flipped && mode === "review" && (
                <div className="sh-fc__review-nav">
                  <button
                    className="lc-btn lc-btn--ghost lc-btn--sm"
                    onClick={() => { setReviewIndex(Math.max(0, reviewIndex - 1)); setFlipped(false); setShowHint(false); }}
                    disabled={safeIndex === 0}
                  >
                    {"\u00D6"}nceki
                  </button>
                  <span className="sh-fc__review-progress">
                    {safeIndex + 1} / {reviewCards.length}
                  </span>
                  <button
                    className="lc-btn lc-btn--primary lc-btn--sm"
                    onClick={() => { setReviewIndex(Math.min(reviewCards.length - 1, reviewIndex + 1)); setFlipped(false); setShowHint(false); }}
                    disabled={safeIndex === reviewCards.length - 1}
                  >
                    Sonraki
                  </button>
                </div>
              )}

              {/* Card meta */}
              {reviewCard.topic && (
                <div className="sh-fc__card-meta sh-fc__card-meta--review">
                  <span className="sh-fc__topic-tag">{reviewCard.topic}</span>
                  {getSourceTag(reviewCard.source) && reviewCard.source !== "manual" && (
                    <span className="sh-fc__source-tag">{getSourceTag(reviewCard.source)}</span>
                  )}
                  <span className="sh-fc__meta-author">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: "-1px", marginRight: 2 }}>
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                    {reviewCard.createdByNickname}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Grid mode (default) ──
  return (
    <div className="sh-tool">
      {/* Header with gradient icon area */}
      <div className="sh-tool__header sh-fc__header--gradient">
        <div className="sh-tool__header-left">
          <div className="sh-fc__header-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="4" width="20" height="16" rx="2" />
              <path d="M2 10h20" />
            </svg>
          </div>
          <h3 className="sh-main-content__channel-name">Flashcards - {topic}</h3>
          <span className="sh-fc__counter-pill">{cards.length} kart</span>
        </div>
        <div className="sh-tool__header-right">
          {dueCards.length > 0 && (
            <button
              className="sh-fc__action-btn sh-fc__action-btn--review"
              onClick={() => startReview("sm2-review")}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
              Tekrar ({dueCards.length})
            </button>
          )}
          <button
            className="lc-btn lc-btn--ghost lc-btn--sm"
            onClick={() => startReview("review")}
          >
            G{"\u00F6"}zden Ge{"\u00E7"}ir
          </button>
          <button
            className="sh-fc__action-btn sh-fc__action-btn--generate"
            onClick={handleGenerate}
            disabled={generating}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
            </svg>
            {generating ? "Olu\u015Fturuluyor..." : "AI ile Olu\u015Ftur"}
          </button>
          {hasLesson && (
            <button
              className="sh-fc__action-btn sh-fc__action-btn--extract"
              onClick={handleExtract}
              disabled={extracting}
              title="Ders materyalinden direkt kart cikar (AI kullanmaz)"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              {extracting ? "\u00C7\u0131kar\u0131l\u0131yor..." : "Dersten \u00C7\u0131kar"}
            </button>
          )}
          <button
            className="lc-btn lc-btn--ghost lc-btn--sm"
            onClick={() => setShowAddForm(prev => !prev)}
          >
            {showAddForm ? "Kapat" : "+ Kart Ekle"}
          </button>
        </div>
      </div>

      <div className="sh-tool__body">
        {/* Extraction result banner */}
        {extractionResult && (
          <div className="sh-fc__extraction-banner sh-fc__extraction-banner--enhanced">
            <div className="sh-fc__extraction-banner-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <polyline points="16 13 12 17 8 13" />
                <line x1="12" y1="9" x2="12" y2="17" />
              </svg>
            </div>
            <div className="sh-fc__extraction-banner-content">
              {extractionResult.total > 0 ? (
                <>
                  <strong>{extractionResult.total} kart {"\u00E7"}{"\u0131"}kar{"\u0131"}ld{"\u0131"}</strong>
                  <span className="sh-fc__extraction-banner-details">
                    {extractionResult.emphases > 0 && (
                      <span className="sh-fc__extraction-chip">{extractionResult.emphases} vurgu</span>
                    )}
                    {extractionResult.quickQuiz > 0 && (
                      <span className="sh-fc__extraction-chip">{extractionResult.quickQuiz} cheat sheet</span>
                    )}
                    {extractionResult.miniQuiz > 0 && (
                      <span className="sh-fc__extraction-chip">{extractionResult.miniQuiz} mini quiz</span>
                    )}
                    {extractionResult.mustRemember > 0 && (
                      <span className="sh-fc__extraction-chip">{extractionResult.mustRemember} anahtar bilgi</span>
                    )}
                  </span>
                </>
              ) : (
                <span>T{"\u00FC"}m kartlar zaten mevcut, yeni kart eklenmedi.</span>
              )}
            </div>
            <button className="sh-fc__extraction-banner-close" onClick={() => setExtractionResult(null)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        )}

        {/* Stats bar with mini rings */}
        <div className="sh-fc__stats sh-fc__stats--cards">
          <div className="sh-fc__stat-card">
            <StatRing percent={100} color="var(--accent-2)" />
            <div className="sh-fc__stat-info">
              <span className="sh-fc__stat-value">{cards.length}</span>
              <span className="sh-fc__stat-label">Toplam</span>
            </div>
          </div>
          <div className="sh-fc__stat-card sh-fc__stat-card--due">
            <StatRing percent={duePercent} color="var(--danger)" />
            <div className="sh-fc__stat-info">
              <span className="sh-fc__stat-value" style={{ color: dueCards.length > 0 ? "var(--danger)" : undefined }}>
                {dueCards.length}
              </span>
              <span className="sh-fc__stat-label">Tekrar Bekliyor</span>
            </div>
          </div>
          <div className="sh-fc__stat-card sh-fc__stat-card--done">
            <StatRing percent={reviewedPercent} color="#27ae60" />
            <div className="sh-fc__stat-info">
              <span className="sh-fc__stat-value">{reviewedCount}</span>
              <span className="sh-fc__stat-label">Tekrarland{"\u0131"}</span>
            </div>
          </div>
          <div className="sh-fc__stat-card sh-fc__stat-card--mastered">
            <StatRing percent={masteredPercent} color="var(--accent-2)" />
            <div className="sh-fc__stat-info">
              <span className="sh-fc__stat-value">{masteredCount}</span>
              <span className="sh-fc__stat-label">G{"\u00FC"}ncel</span>
            </div>
          </div>
        </div>

        {/* Add form */}
        {showAddForm && (
          <form className="sh-fc__add-form sh-fc__add-form--polished" onSubmit={handleAddCard}>
            <div className="sh-fc__add-form-header">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              <span>Yeni Kart Ekle</span>
            </div>
            <input
              className="lc-input"
              type="text"
              placeholder={"\u00D6n Y\u00FCz (soru)"}
              value={front}
              onChange={e => setFront(e.target.value)}
              required
            />
            <textarea
              className="lc-textarea"
              placeholder={"Arka Y\u00FCz (cevap)"}
              value={back}
              onChange={e => setBack(e.target.value)}
              rows={3}
              required
            />
            <input
              className="lc-input"
              type="text"
              placeholder="Konu"
              value={cardTopic}
              onChange={e => setCardTopic(e.target.value)}
            />
            <div className="sh-fc__add-form-actions">
              <button type="button" className="lc-btn lc-btn--ghost lc-btn--sm" onClick={() => setShowAddForm(false)}>
                {"\u0130"}ptal
              </button>
              <button type="submit" className="lc-btn lc-btn--primary lc-btn--sm">
                Ekle
              </button>
            </div>
          </form>
        )}

        {/* Card Grid */}
        <div className="sh-fc__grid sh-fc__grid--large">
          {cards.map(card => {
            const isRevealed = revealedCards.has(card.id);
            const voteScore = getVoteScore(card);
            const userVote = getUserVote(card);
            const isDue = isDueForReview(card, userId);
            const daysUntil = getDaysUntilReview(card, userId);
            const sourceTag = getSourceTag(card.source);

            return (
              <motion.div
                key={card.id}
                className={`sh-fc__card sh-fc__card--enhanced${isRevealed ? " sh-fc__card--revealed" : ""}${isDue ? " sh-fc__card--due" : ""}`}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ y: -4 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                onClick={() => toggleReveal(card.id)}
              >
                {/* Source tag badge - prominent */}
                {sourceTag && card.source !== "manual" && (
                  <span className={`sh-fc__source-tag sh-fc__source-tag--${card.source}`}>
                    {card.source === "ai-generated" && (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: "-1px", marginRight: 2 }}>
                        <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
                      </svg>
                    )}
                    {sourceTag}
                  </span>
                )}

                {/* Flip visual cue icon */}
                <div className="sh-fc__card-flip-icon">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="23 4 23 10 17 10" />
                    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                  </svg>
                </div>

                <div className="sh-fc__card-front">
                  <p>{card.front}</p>
                </div>

                {isRevealed && (
                  <div className="sh-fc__card-back">
                    <p>{card.back}</p>
                    {card.hint && (
                      <p className="sh-fc__card-hint">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: "-1px", marginRight: 3 }}>
                          <line x1="9" y1="18" x2="15" y2="18" />
                          <line x1="10" y1="22" x2="14" y2="22" />
                          <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14" />
                        </svg>
                        {card.hint}
                      </p>
                    )}
                  </div>
                )}

                <div className="sh-fc__card-meta">
                  <span className="sh-fc__meta-author">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: "-1px", marginRight: 2 }}>
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                    {card.createdByNickname}
                  </span>
                  <div className="sh-fc__card-meta-right">
                    {card.topic && <span className="sh-fc__topic-tag">{card.topic}</span>}
                    {daysUntil !== null && (
                      <span className={`sh-fc__due-badge${isDue ? " sh-fc__due-badge--now" : ""}`}>
                        {isDue ? "Tekrar!" : `${daysUntil}g`}
                      </span>
                    )}
                  </div>
                </div>

                <div className="sh-fc__card-votes" onClick={e => e.stopPropagation()}>
                  <button
                    className={`sh-fc__vote-btn${userVote === "up" ? " sh-fc__vote-btn--active" : ""}`}
                    onClick={() => handleVote(card, "up")}
                  >
                    {"\u25B2"}
                  </button>
                  <span className="sh-fc__vote-score">{voteScore}</span>
                  <button
                    className={`sh-fc__vote-btn${userVote === "down" ? " sh-fc__vote-btn--active" : ""}`}
                    onClick={() => handleVote(card, "down")}
                  >
                    {"\u25BC"}
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
