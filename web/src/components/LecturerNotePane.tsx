// components/LecturerNotePane.tsx
import React, { useMemo, useState } from "react";
import { Emphasis, LoAlignment } from "../types";

type Props = {
  lectureText: string;
  slidesText: string;
  emphases: Emphasis[];
  learningOutcomes: string[];
  loAlignment: LoAlignment | null;
};

type EmphasisSource = "lecture" | "slides" | "both" | undefined;
type Importance = "high" | "medium" | "low";

type EnrichedEmphasis = Emphasis & {
  __index: number; // orijinal sıra
};

function normalizeSource(e: Emphasis): EmphasisSource {
  const raw = (e as any).source as string | undefined;
  if (raw === "lecture" || raw === "slides" || raw === "both") return raw;

  if ((e as any).in_slides === true) return "both";
  return "lecture";
}

function getImportance(e: Emphasis): Importance {
  const raw =
    ((e as any).importance ||
      (e as any).importance_level ||
      (e as any).exam_risk ||
      "") +
    "";
  const v = raw.toLowerCase();
  if (v === "high") return "high";
  if (v === "low") return "low";
  return "medium";
}

function getSourceChip(e: Emphasis) {
  const src = normalizeSource(e);
  switch (src) {
    case "lecture":
      return {
        label: "Lecture only",
        icon: "🗣",
        className: "ln-chip ln-chip--lecture",
        tooltip: "Emphasis mainly comes from the spoken transcript.",
      };
    case "slides":
      return {
        label: "Slide only",
        icon: "📄",
        className: "ln-chip ln-chip--slides",
        tooltip: "Emphasis mainly comes from the slide text.",
      };
    case "both":
      return {
        label: "Lecture + slides",
        icon: "🗣📄",
        className: "ln-chip ln-chip--both",
        tooltip: "The same idea is stressed in both transcript and slides.",
      };
    default:
      return {
        label: "Unclassified",
        icon: "•",
        className: "ln-chip ln-chip--neutral",
        tooltip: "Source not clearly classified.",
      };
  }
}

function getImportanceChip(importance: Importance) {
  if (importance === "high") {
    return {
      label: "High exam risk",
      className: "ln-chip ln-chip--importance ln-chip--high",
    };
  }
  if (importance === "low") {
    return {
      label: "Nice to know",
      className: "ln-chip ln-chip--importance ln-chip--low",
    };
  }
  return {
    label: "Normal",
    className: "ln-chip ln-chip--importance ln-chip--medium",
  };
}

function truncate(text: string, max: number): string {
  if (!text) return "";
  if (text.length <= max) return text;
  return text.slice(0, max - 1).trimEnd() + "…";
}

const LecturerNotePane: React.FC<Props> = ({
  lectureText,
  slidesText,
  emphases,
  learningOutcomes,
  loAlignment,
}) => {
  const [filterSource, setFilterSource] = useState<
    "all" | EmphasisSource
  >("all");
  const [filterImportance, setFilterImportance] = useState<
    "all" | Importance
  >("all");
  const [sortKey, setSortKey] = useState<"recommended" | "lo" | "order">(
    "recommended"
  );
  const [modalIndex, setModalIndex] = useState<number | null>(null);
  const [openSelfCheckIdx, setOpenSelfCheckIdx] = useState<number | null>(
    null
  );

  const loMap = useMemo(() => {
    const map: Record<
      string,
      { id: string; title: string; index: number }
    > = {};
    learningOutcomes.forEach((lo, i) => {
      const id = `LO${i + 1}`;
      map[id] = { id, title: lo, index: i };
    });
    return map;
  }, [learningOutcomes]);

  const enriched: EnrichedEmphasis[] = useMemo(
    () =>
      (emphases || []).map((e, idx) => ({
        ...(e as any),
        __index: idx,
      })),
    [emphases]
  );

  const total = enriched.length;
  const countLecture = enriched.filter(
    (e) => normalizeSource(e) === "lecture"
  ).length;
  const countSlides = enriched.filter(
    (e) => normalizeSource(e) === "slides"
  ).length;
  const countBoth = enriched.filter(
    (e) => normalizeSource(e) === "both"
  ).length;

  const visible: EnrichedEmphasis[] = useMemo(() => {
    let items = [...enriched];

    if (filterSource !== "all") {
      items = items.filter((e) => normalizeSource(e) === filterSource);
    }

    if (filterImportance !== "all") {
      items = items.filter((e) => getImportance(e) === filterImportance);
    }

    if (sortKey === "recommended") {
      const weight = (imp: Importance) =>
        imp === "high" ? 2 : imp === "medium" ? 1 : 0;
      items.sort(
        (a, b) =>
          weight(getImportance(b)) - weight(getImportance(a)) ||
          a.__index - b.__index
      );
    } else if (sortKey === "lo") {
      const getFirstLoIndex = (e: EnrichedEmphasis) => {
        const ids: string[] = (e as any).related_lo_ids || [];
        const first = ids[0];
        if (!first || !loMap[first]) return 999;
        return loMap[first].index;
      };
      items.sort(
        (a, b) =>
          getFirstLoIndex(a) - getFirstLoIndex(b) ||
          a.__index - b.__index
      );
    } else {
      // original order
      items.sort((a, b) => a.__index - b.__index);
    }

    return items;
  }, [enriched, filterSource, filterImportance, sortKey, loMap]);

  const selected =
    modalIndex != null && modalIndex >= 0 && modalIndex < visible.length
      ? visible[modalIndex]
      : null;

  const handleOpenModal = (idx: number) => {
    setModalIndex(idx);
    setOpenSelfCheckIdx(null);
  };

  const handleCloseModal = () => {
    setModalIndex(null);
    setOpenSelfCheckIdx(null);
  };

  const gotoPrev = () => {
    if (!visible.length || modalIndex == null) return;
    setModalIndex((prev) =>
      prev == null ? 0 : (prev - 1 + visible.length) % visible.length
    );
    setOpenSelfCheckIdx(null);
  };

  const gotoNext = () => {
    if (!visible.length || modalIndex == null) return;
    setModalIndex((prev) =>
      prev == null ? 0 : (prev + 1) % visible.length
    );
    setOpenSelfCheckIdx(null);
  };

  return (
    <div className="lc-section ln-root">
      {/* Toolbar: özet + filtreler + sıralama */}
      <header className="ln-header mb-3">
        <div>
          <h2 className="panel__title mb-1">Teacher Notes</h2>
          <p className="muted small">
            Processed highlights of what the instructor really stressed in
            the lecture. Click a card to see the full explanation and
            self-check questions.
          </p>
        </div>

        {total > 0 && (
          <div className="ln-summary-row">
            <span className="ln-summary-chip">
              <span className="ln-summary-label">Total</span>
              <span className="ln-summary-value">{total}</span>
            </span>
            <span className="ln-summary-chip">
              <span className="ln-summary-label">Lecture only</span>
              <span className="ln-summary-value">{countLecture}</span>
            </span>
            <span className="ln-summary-chip">
              <span className="ln-summary-label">Lecture + slides</span>
              <span className="ln-summary-value">{countBoth}</span>
            </span>
            <span className="ln-summary-chip">
              <span className="ln-summary-label">Slide only</span>
              <span className="ln-summary-value">{countSlides}</span>
            </span>
          </div>
        )}

        <div className="ln-toolbar">
          <div className="ln-filter-group">
            <span className="ln-filter-label small">Source</span>
            <div className="ln-filter-chips">
              {[
                { id: "all", label: "All" },
                { id: "lecture", label: "Lecture only" },
                { id: "both", label: "Lecture + slides" },
                { id: "slides", label: "Slide only" },
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className={
                    "ln-filter-chip" +
                    (filterSource === f.id ? " ln-filter-chip--active" : "")
                  }
                  onClick={() =>
                    setFilterSource(f.id as "all" | EmphasisSource)
                  }
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="ln-filter-group">
            <span className="ln-filter-label small">Importance</span>
            <div className="ln-filter-chips">
              {[
                { id: "all", label: "All" },
                { id: "high", label: "High" },
                { id: "medium", label: "Normal" },
                { id: "low", label: "Low" },
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className={
                    "ln-filter-chip" +
                    (filterImportance === f.id
                      ? " ln-filter-chip--active"
                      : "")
                  }
                  onClick={() =>
                    setFilterImportance(f.id as "all" | Importance)
                  }
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="ln-sort">
            <span className="ln-filter-label small">Sort</span>
            <select
              className="ln-sort-select"
              value={sortKey}
              onChange={(e) =>
                setSortKey(e.target.value as "recommended" | "lo" | "order")
              }
            >
              <option value="recommended">Recommended</option>
              <option value="lo">By LO</option>
              <option value="order">Lecture order</option>
            </select>
          </div>
        </div>
      </header>

      {/* Kart grid'i */}
      {visible.length === 0 ? (
        <div className="muted-block small">
          No teacher highlights yet. Run <strong>Plan &amp; Analyze</strong>{" "}
          first, then the strongest emphases will appear here.
        </div>
      ) : (
        <div className="ln-card-grid">
          {visible.map((e, idx) => {
            const srcChip = getSourceChip(e);
            const importance = getImportance(e);
            const impChip = getImportanceChip(importance);
            const transcriptQuote =
              (e as any).from_transcript_quote || "";
            const loIds: string[] = (e as any).related_lo_ids || [];
            const primaryLoId = loIds[0];
            const loInfo = primaryLoId ? loMap[primaryLoId] : undefined;

            return (
              <article
                key={idx}
                className="ln-card"
                onClick={() => handleOpenModal(idx)}
              >
                <div className="ln-card-chip-row">
                  <span
                    className={srcChip.className}
                    title={srcChip.tooltip}
                  >
                    <span className="ln-chip-icon">{srcChip.icon}</span>
                    <span className="ln-chip-label">
                      {srcChip.label}
                    </span>
                  </span>

                  {loInfo && (
                    <span className="ln-chip ln-chip--lo">
                      {loInfo.id} – {truncate(loInfo.title, 40)}
                    </span>
                  )}

                  <span className={impChip.className}>
                    {impChip.label}
                  </span>
                </div>

                <h3 className="ln-card-title">
                  {e.statement || "Untitled emphasis"}
                </h3>

                {e.why && (
                  <p className="ln-card-sub">
                    {truncate(e.why, 180)}
                  </p>
                )}

                {transcriptQuote && (
                  <p className="ln-card-quote small">
                    “{truncate(transcriptQuote, 120)}”
                  </p>
                )}

                <div className="ln-card-footer">
                  <button
                    type="button"
                    className="ln-card-action"
                    onClick={(ev) => {
                      ev.stopPropagation();
                      handleOpenModal(idx);
                    }}
                  >
                    View details
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Learning Outcomes kutusu */}
      <section className="card ln-lo-card mt-4">
        <div className="label">Learning Outcomes (LO)</div>
        {learningOutcomes && learningOutcomes.length > 0 ? (
          <ol className="ol small mt-1">
            {learningOutcomes.map((lo, i) => (
              <li key={i}>
                <strong>{`LO${i + 1}: `}</strong>
                {lo}
              </li>
            ))}
          </ol>
        ) : (
          <p className="small muted mt-1">
            No official learning outcomes have been attached yet. Once you
            fetch them from the syllabus, they will be listed here.
          </p>
        )}
      </section>

      {/* Detay modalı */}
      {selected && (
        <div className="ln-modal-backdrop" onClick={handleCloseModal}>
          <div
            className="ln-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="ln-modal-header">
              <div className="ln-modal-chips">
                {(() => {
                  const srcChip = getSourceChip(selected);
                  const importance = getImportance(selected);
                  const impChip = getImportanceChip(importance);
                  const loIds: string[] =
                    (selected as any).related_lo_ids || [];
                  const loLabels = loIds
                    .map((id) =>
                      loMap[id] ? `${id} – ${loMap[id].title}` : id
                    )
                    .join(", ");

                  return (
                    <>
                      <span
                        className={srcChip.className}
                        title={srcChip.tooltip}
                      >
                        <span className="ln-chip-icon">
                          {srcChip.icon}
                        </span>
                        <span className="ln-chip-label">
                          {srcChip.label}
                        </span>
                      </span>

                      {loIds.length > 0 && (
                        <span className="ln-chip ln-chip--lo">
                          {loLabels}
                        </span>
                      )}

                      <span className={impChip.className}>
                        {impChip.label}
                      </span>
                    </>
                  );
                })()}
              </div>

              <button
                type="button"
                className="ln-modal-close"
                onClick={handleCloseModal}
              >
                ✕
              </button>
            </header>

            <main className="ln-modal-body">
              <section className="ln-modal-section">
                <h3 className="ln-section-title">Core idea</h3>
                <p className="ln-core-text">
                  {selected.statement || "Untitled emphasis"}
                </p>
              </section>

              {selected.why && (
                <section className="ln-modal-section">
                  <h3 className="ln-section-title">Why it matters</h3>
                  <p className="ln-body-text">{selected.why}</p>
                </section>
              )}

              {((selected as any).from_transcript_quote ||
                (selected as any).from_slide_quote) && (
                <section className="ln-modal-section ln-modal-section--split">
                  <div className="ln-quote-block">
                    <div className="ln-quote-label small">
                      From lecture
                    </div>
                    <blockquote className="ln-quote">
                      {(selected as any).from_transcript_quote ||
                        "—"}
                    </blockquote>
                  </div>
                  <div className="ln-quote-block">
                    <div className="ln-quote-label small">
                      From slides
                    </div>
                    <blockquote className="ln-quote ln-quote--slide">
                      {(selected as any).from_slide_quote || "—"}
                    </blockquote>
                  </div>
                </section>
              )}

              <section className="ln-modal-section">
                <h3 className="ln-section-title">Quick self-check</h3>
                <ul className="ln-selfcheck-list">
                  {[
                    {
                      q: "Can you explain this idea in your own words in 1–2 sentences?",
                      a:
                        selected.statement ||
                        "Summarise it in your own words.",
                    },
                    {
                      q: "Which example from the lecture best illustrates this point?",
                      a:
                        (selected as any).from_transcript_quote ||
                        "Recall one concrete example the instructor used.",
                    },
                    {
                      q: "Which LO(s) would this most likely appear under in an exam?",
                      a:
                        ((selected as any).related_lo_ids || [])
                          .map((id: string) =>
                            loMap[id]
                              ? `${id} – ${loMap[id].title}`
                              : id
                          )
                          .join(", ") || "Match it to the most relevant LO.",
                    },
                  ].map((item, idx) => (
                    <li key={idx} className="ln-selfcheck-item">
                      <button
                        type="button"
                        className="ln-selfcheck-question"
                        onClick={() =>
                          setOpenSelfCheckIdx(
                            openSelfCheckIdx === idx ? null : idx
                          )
                        }
                      >
                        {item.q}
                      </button>
                      {openSelfCheckIdx === idx && (
                        <p className="ln-selfcheck-answer small">
                          {item.a}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            </main>

            <footer className="ln-modal-footer">
              <div className="ln-modal-nav">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={gotoPrev}
                >
                  ← Previous
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={gotoNext}
                >
                  Next →
                </button>
              </div>
              <div className="ln-modal-hint small muted">
                Tip: You can treat each card as a mini flashcard. Clear all
                questions in the self-check section before marking this
                topic as “done”.
              </div>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
};

export default LecturerNotePane;
