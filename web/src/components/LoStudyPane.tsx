import React, { useEffect, useMemo, useState } from "react";
import { LoStudyModule } from "../types";

type Props = {
  modules: LoStudyModule[];
};

export default function LoStudyPane({ modules }: Props) {
  // ── Guard: hiç LO yoksa basit mesaj ─────────────────────────
  if (!modules || !modules.length) {
    return (
      <div className="muted-block">
        Bu ders için henüz LO bazlı çalışma modülleri oluşturulmadı.
      </div>
    );
  }

  // ── Local state ──────────────────────────────────────────────
  const [activeLoId, setActiveLoId] = useState<string | null>(null);
  const [completedIds, setCompletedIds] = useState<string[]>([]);
  const [filter, setFilter] = useState<"all" | "todo">("all");
  const [quizRevealed, setQuizRevealed] = useState(false);

  // Tamamlananları hızlıca set olarak da kullanmak için
  const completedSet = useMemo(
    () => new Set(completedIds),
    [completedIds]
  );

  // Görünen liste (filtreye göre)
  const visibleModules = useMemo(() => {
    if (filter === "all") return modules;
    return modules.filter((m) => !completedSet.has(m.loId));
  }, [modules, filter, completedSet]);

  // Aktif LO’yu her değişiklikte valid tut
  useEffect(() => {
    if (!visibleModules.length) {
      setActiveLoId(null);
      return;
    }
    if (!activeLoId || !visibleModules.some((m) => m.loId === activeLoId)) {
      setActiveLoId(visibleModules[0].loId);
      setQuizRevealed(false);
    }
  }, [visibleModules, activeLoId]);

  const active =
    visibleModules.find((m) => m.loId === activeLoId) ||
    visibleModules[0];

  // Özet bilgiler
  const totalCount = modules.length;
  const completedCount = completedIds.length;
  const totalTime = modules.reduce(
    (sum, m) => sum + (m.recommended_study_time_min || 0),
    0
  );
  const completedTime = modules
    .filter((m) => completedSet.has(m.loId))
    .reduce(
      (sum, m) => sum + (m.recommended_study_time_min || 0),
      0
    );

  const handleToggleComplete = (loId: string) => {
    setCompletedIds((prev) =>
      prev.includes(loId)
        ? prev.filter((id) => id !== loId)
        : [...prev, loId]
    );
  };

  return (
    <div className="lc-lo-study">
      {/* Üst özet bar */}
      <div className="lo-summary-bar card mb-3">
        <div className="lo-summary-item">
          <div className="lo-summary-label">Toplam LO</div>
          <div className="lo-summary-value">{totalCount}</div>
        </div>
        <div className="lo-summary-item">
          <div className="lo-summary-label">Tamamlanan</div>
          <div className="lo-summary-value">
            {completedCount} / {totalCount}
          </div>
        </div>
        <div className="lo-summary-item">
          <div className="lo-summary-label">Tahmini Süre</div>
          <div className="lo-summary-value">
            {completedTime} / {totalTime} dk
          </div>
        </div>
        <div className="lo-summary-spacer" />
        <div className="lo-summary-filter">
          <button
            type="button"
            className={
              filter === "all"
                ? "chip chip--active"
                : "chip"
            }
            onClick={() => setFilter("all")}
          >
            Tümü
          </button>
          <button
            type="button"
            className={
              filter === "todo"
                ? "chip chip--active"
                : "chip"
            }
            onClick={() => setFilter("todo")}
          >
            Sıradaki
          </button>
        </div>
      </div>

<div className="lc-two-col lc-two-col--lo-study">
        {/* SOL: LO listesi */}
        <aside className="lc-section ln-sidebar">
          <div className="panel__title mb-2">Learning Outcomes</div>
          {visibleModules.length === 0 ? (
            <div className="muted small">
              Filtreye göre gösterilecek LO kalmadı.
            </div>
          ) : (
            <ol className="ol">
              {visibleModules.map((m) => {
                const isActive = m.loId === activeLoId;
                const isDone = completedSet.has(m.loId);
                return (
                  <li
                    key={m.loId}
                    className={
                      "lo-item" +
                      (isActive ? " lo-item--active" : "") +
                      (isDone ? " lo-item--done" : "")
                    }
                    onClick={() => {
                      setActiveLoId(m.loId);
                      setQuizRevealed(false);
                    }}
                  >
                    <div className="lo-item-main">
                      <span className="lo-item-id">{m.loId}</span>
                      <span className="lo-item-title">
                        {m.loTitle}
                      </span>
                    </div>
                    <div className="lo-item-meta">
                      <span className="lo-item-time">
                        {m.recommended_study_time_min} dk
                      </span>
                      {isDone && (
                        <span className="lo-item-status">
                          ✅
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </aside>

        {/* SAĞ: Seçili LO için modül */}
        {active && (
          <div className="lc-section">
            <div className="lo-header mb-2">
              <div>
                <div className="panel__title mb-1">
                  {active.loId} – {active.loTitle}
                </div>
                <p className="muted small">
                  Önerilen çalışma süresi:{" "}
                  {active.recommended_study_time_min} dk
                </p>
              </div>
              <div className="lo-header-actions">
                <button
                  type="button"
                  className={
                    completedSet.has(active.loId)
                      ? "btn-small btn-secondary"
                      : "btn-small"
                  }
                  onClick={() =>
                    handleToggleComplete(active.loId)
                  }
                >
                  {completedSet.has(active.loId)
                    ? "Tamamlandı işaretini kaldır"
                    : "Bu LO’yu tamamlandı işaretle"}
                </button>
              </div>
            </div>

            <div className="card mb-2">
              <div className="label">Kısaca</div>
              <p>{active.oneLineGist}</p>
            </div>

            <div className="card mb-2">
              <div className="label">Çekirdek Fikirler</div>
              <ul className="ul">
                {active.coreIdeas.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </div>

            <div className="card mb-2">
              <div className="label">Mutlaka Hatırla</div>
              <ul className="ul">
                {active.mustRemember.map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
              </ul>
            </div>

            <div className="card mb-2">
              <div className="label">Sezgisel Anlatım</div>
              <p>{active.intuitiveExplanation}</p>
            </div>

            {active.typicalQuestions?.length > 0 && (
              <div className="card mb-2">
                <div className="label">Tipik Sorular</div>
                <ul className="ul">
                  {active.typicalQuestions.map((q, i) => (
                    <li key={i}>{q}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Mini Quiz */}
            {active.miniQuiz?.length > 0 && (
              <div className="card">
                <div className="lo-quiz-header">
                  <div className="label">Mini Quiz</div>
                  <button
                    type="button"
                    className="btn-small btn-ghost"
                    onClick={() =>
                      setQuizRevealed((prev) => !prev)
                    }
                  >
                    {quizRevealed
                      ? "Cevapları gizle"
                      : "Cevapları göster"}
                  </button>
                </div>
                <ul className="ul">
                  {active.miniQuiz.map((q, i) => (
                    <li key={i} className="lo-quiz-item">
                      <div className="lo-quiz-question">
                        <strong>Soru {i + 1}:</strong> {q.question}
                      </div>
                      {quizRevealed && (
                        <div className="lo-quiz-answer small">
                          <div>
                            <strong>Cevap:</strong> {q.answer}
                          </div>
                          <div>
                            <strong>Neden:</strong> {q.why}
                          </div>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
