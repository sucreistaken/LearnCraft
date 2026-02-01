import React, { useEffect } from "react";
import { useWeaknessStore } from "../stores/weaknessStore";
import { useLessonStore } from "../stores/lessonStore";

function RatioBar({ ratio, label }: { ratio: number; label: string }) {
  const pct = Math.round(ratio * 100);
  const color =
    pct < 50 ? "var(--danger)" : pct < 70 ? "var(--warning)" : "var(--success)";

  return (
    <div>
      <div className="wk-ratio-label">
        <span>{label}</span>
        <span className="wk-ratio-value" style={{ color }}>{pct}%</span>
      </div>
      <div className="wk-ratio-track">
        <div className="wk-ratio-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

function TrendBadge({ trend }: { trend: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    improving: { label: "Improving", cls: "status-badge--success" },
    stable: { label: "Stable", cls: "status-badge--muted" },
    declining: { label: "Declining", cls: "status-badge--danger" },
  };
  const t = map[trend] || map.stable;
  return <span className={`status-badge ${t.cls}`}>{t.label}</span>;
}

export default function WeaknessPane() {
  const {
    summary,
    lessonAnalysis,
    loading,
    error,
    fetchGlobal,
    analyzeAll,
    analyzeLesson,
    fetchForLesson,
  } = useWeaknessStore();

  const currentLessonId = useLessonStore((s) => s.currentLessonId);

  useEffect(() => {
    fetchGlobal();
    if (currentLessonId) fetchForLesson(currentLessonId);
  }, [currentLessonId]);

  return (
    <div className="grid-gap-12">
      {/* Header */}
      <section className="lc-section">
        <div className="pane-header">
          <div className="pane-header__info">
            <div className="pane-header__title">Weakness Tracker</div>
            <div className="pane-header__desc">
              Identify and focus on your weakest topics across all lessons.
            </div>
          </div>
          <div className="pane-header__actions">
            {currentLessonId && (
              <button
                className="btn-small"
                onClick={() => analyzeLesson(currentLessonId)}
                disabled={loading}
              >
                {loading ? "Analyzing..." : "Analyze Lesson"}
              </button>
            )}
            <button className="btn" onClick={analyzeAll} disabled={loading}>
              {loading ? "Analyzing..." : "Analyze All"}
            </button>
          </div>
        </div>

        {error && (
          <div className="status-badge status-badge--danger" style={{ marginTop: 10 }}>
            {error}
          </div>
        )}
      </section>

      {/* Current Lesson Analysis */}
      {lessonAnalysis && lessonAnalysis.topics.length > 0 && (
        <section className="lc-section">
          <div className="wk-section-title">
            Lesson: {lessonAnalysis.lessonTitle}
          </div>
          <div className="small" style={{ color: "var(--muted)", marginBottom: 14 }}>
            Analyzed {new Date(lessonAnalysis.analyzedAt).toLocaleString()}
          </div>

          <div style={{ display: "grid", gap: 8 }}>
            {lessonAnalysis.topics.map((topic, i) => (
              <div
                key={i}
                className={`wk-topic-card${topic.isWeak ? " wk-topic-card--weak" : ""}`}
              >
                <div className="wk-topic-header">
                  <span className="wk-topic-name">{topic.topicName}</span>
                  <div className="wk-topic-meta">
                    <TrendBadge trend={topic.trend} />
                    {topic.isWeak && (
                      <span className="status-badge status-badge--danger">WEAK</span>
                    )}
                  </div>
                </div>
                <RatioBar
                  ratio={topic.ratio}
                  label={`${topic.correctAnswers}/${topic.totalQuestions} correct`}
                />
                {topic.loId && (
                  <div className="wk-linked">Linked: {topic.loId}</div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Global Summary */}
      {summary && summary.globalWeakTopics.length > 0 && (
        <section className="lc-section">
          <div className="wk-section-title">Global Weak Topics</div>

          <div style={{ display: "grid", gap: 8 }}>
            {summary.globalWeakTopics.map((topic, i) => (
              <div key={i} className="wk-topic-card wk-topic-card--weak">
                <div className="wk-topic-header">
                  <span className="wk-topic-name">{topic.topicName}</span>
                  <span className="status-badge status-badge--info">
                    {topic.lessonIds.length} lesson{topic.lessonIds.length > 1 ? "s" : ""}
                  </span>
                </div>
                <RatioBar
                  ratio={topic.averageRatio}
                  label={`Average across ${topic.lessonIds.length} lesson(s)`}
                />
                <div className="wk-recommendation">{topic.recommendation}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Study Priority */}
      {summary && summary.studyPriority.length > 0 && (
        <section className="lc-section">
          <div className="wk-section-title">Study Priority Order</div>
          <ol className="wk-priority-list">
            {summary.studyPriority.map((topic, i) => (
              <li key={i} className="wk-priority-item">
                <span className="wk-priority-num">{i + 1}</span>
                <span>{topic}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* Empty State */}
      {!loading && !lessonAnalysis && !summary?.globalWeakTopics.length && (
        <section className="lc-section">
          <div className="pane-empty">
            <div className="pane-empty__icon">W</div>
            <div className="pane-empty__title">No weakness data yet</div>
            <div className="pane-empty__desc">
              Click "Analyze All" to scan your quiz results and identify weak areas.
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
