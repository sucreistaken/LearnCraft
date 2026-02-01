import React, { useEffect, useMemo, useState, useRef } from "react";
import { LoStudyModule } from "../types";
import { motion, AnimatePresence } from "framer-motion";
import { useLessonStore } from "../stores/lessonStore";
import { exportToPdf } from "../utils/pdfExport";

type Props = {
  modules: LoStudyModule[];
};

const STORAGE_KEY_PREFIX = 'lc.lostudy.progress.';

const getStorageKey = (lessonId: string) => `${STORAGE_KEY_PREFIX}${lessonId}`;

export default function LoStudyPane({ modules }: Props) {
  const { currentLessonId } = useLessonStore();

  // Local state - ALL HOOKS MUST BE BEFORE ANY CONDITIONAL RETURNS
  const [activeLoId, setActiveLoId] = useState<string | null>(null);
  const [completedIds, setCompletedIds] = useState<string[]>([]);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['core', 'remember']));
  const [quizRevealed, setQuizRevealed] = useState<{ [key: number]: boolean }>({});
  const [pdfLoading, setPdfLoading] = useState(false);
  const loContentRef = useRef<HTMLDivElement>(null);

  const handleExportPdf = async () => {
    if (!loContentRef.current) return;
    setPdfLoading(true);
    try {
      await exportToPdf(loContentRef.current, "LO_Study_Modules");
    } catch (err) {
      console.error("PDF export error:", err);
    } finally {
      setPdfLoading(false);
    }
  };

  // Load progress from localStorage
  useEffect(() => {
    if (!currentLessonId) return;
    const key = getStorageKey(currentLessonId);
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setCompletedIds(parsed);
        }
      } catch (e) {
        console.error('Failed to parse LO progress:', e);
      }
    }
  }, [currentLessonId]);

  // Save progress to localStorage
  useEffect(() => {
    if (!currentLessonId) return;
    const key = getStorageKey(currentLessonId);
    localStorage.setItem(key, JSON.stringify(completedIds));
  }, [completedIds, currentLessonId]);

  const completedSet = useMemo(() => new Set(completedIds), [completedIds]);

  // Set first LO as active
  useEffect(() => {
    if (!activeLoId && modules.length > 0) {
      setActiveLoId(modules[0].loId);
    }
  }, [modules, activeLoId]);

  // Guard: no LOs - MUST BE AFTER ALL HOOKS
  if (!modules || !modules.length) {
    return (
      <div className="lc-section" style={{ textAlign: 'center', padding: 60 }}>
        <div style={{ fontSize: 60, marginBottom: 16, opacity: 0.5 }}>📚</div>
        <p className="fw-600 fs-16">No LO modules available yet.</p>
        <p className="text-muted fs-12">Generate LO alignment first to see study modules.</p>
      </div>
    );
  }

  const active = modules.find((m) => m.loId === activeLoId) || modules[0];

  // Stats
  const totalCount = modules.length;
  const completedCount = completedIds.length;
  const progress = Math.round((completedCount / totalCount) * 100);
  const totalTime = modules.reduce((sum, m) => sum + (m.recommended_study_time_min || 0), 0);
  const completedTime = modules
    .filter((m) => completedSet.has(m.loId))
    .reduce((sum, m) => sum + (m.recommended_study_time_min || 0), 0);

  const handleToggleComplete = (loId: string) => {
    setCompletedIds((prev) =>
      prev.includes(loId) ? prev.filter((id) => id !== loId) : [...prev, loId]
    );
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  };

  const toggleQuizAnswer = (index: number) => {
    setQuizRevealed(prev => ({ ...prev, [index]: !prev[index] }));
  };

  // Section component
  const Section = ({ id, title, icon, children }: { id: string; title: string; icon: string; children: React.ReactNode }) => {
    const isOpen = expandedSections.has(id);
    return (
      <div className="card mb-3">
        <button
          onClick={() => toggleSection(id)}
          style={{
            width: '100%',
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            textAlign: 'left'
          }}
        >
          <span>{icon}</span>
          <span className="fw-700 flex-1">{title}</span>
          <span style={{ opacity: 0.5 }}>{isOpen ? '▼' : '▶'}</span>
        </button>
        {isOpen && <div style={{ padding: '0 16px 16px' }}>{children}</div>}
      </div>
    );
  };

  return (
    <div ref={loContentRef} style={{
      display: 'grid',
      gridTemplateColumns: '1fr 2fr',
      gap: 16,
      height: '80vh',
      minHeight: 500
    }}>
      {/* Left Sidebar */}
      <aside style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        minWidth: 0
      }}>
        {/* Progress Summary */}
        <div className="lc-section" style={{ padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 52,
              height: 52,
              borderRadius: '50%',
              background: `conic-gradient(${progress === 100 ? '#22c55e' : 'var(--accent-2)'} ${progress * 3.6}deg, var(--border) 0deg)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <div style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                background: 'var(--card)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: 13
              }}>
                {progress}%
              </div>
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 11, opacity: 0.6 }}>Progress</div>
              <div style={{ fontWeight: 700, fontSize: 17 }}>{completedCount}/{totalCount}</div>
              <div style={{ fontSize: 11, opacity: 0.6 }}>⏱️ {completedTime}/{totalTime} min</div>
            </div>
          </div>
          <button className="btn btn-secondary" onClick={handleExportPdf} disabled={pdfLoading} style={{ marginTop: 8, fontSize: 12, width: '100%' }}>
            {pdfLoading ? "Exporting..." : "PDF Export"}
          </button>
        </div>

        {/* LO List */}
        <div className="lc-section" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10, paddingLeft: 4 }}>📋 Learning Outcomes</div>
          <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
            {modules.map((m, index) => {
              const isActive = m.loId === activeLoId;
              const isDone = completedSet.has(m.loId);

              return (
                <div
                  key={m.loId}
                  onClick={() => {
                    setActiveLoId(m.loId);
                    setQuizRevealed({});
                  }}
                  style={{
                    padding: '10px 10px',
                    marginBottom: 6,
                    borderRadius: 10,
                    cursor: 'pointer',
                    background: isActive ? 'var(--accent-2)' : 'transparent',
                    color: isActive ? 'white' : 'var(--text)',
                    border: isActive ? 'none' : '1px solid var(--border)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    transition: 'all 0.15s ease'
                  }}
                >
                  <span style={{
                    width: 22,
                    height: 22,
                    borderRadius: 6,
                    background: isDone ? '#22c55e' : (isActive ? 'rgba(255,255,255,0.25)' : 'var(--border)'),
                    color: isDone || isActive ? 'white' : 'var(--text)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 10,
                    fontWeight: 700,
                    flexShrink: 0
                  }}>
                    {isDone ? '✓' : index + 1}
                  </span>
                  <span style={{
                    flex: 1,
                    fontSize: 12,
                    fontWeight: 500,
                    overflow: 'hidden',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical' as const,
                    lineHeight: 1.4
                  }}>
                    {m.loTitle}
                  </span>
                  <span style={{ fontSize: 10, opacity: 0.7, flexShrink: 0 }}>
                    {m.recommended_study_time_min}m
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      {active && (
        <div className="lc-section" style={{
          flex: 1,
          overflow: 'auto',
          padding: 20,
          minWidth: 0
        }}>
          {/* Header */}
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 14,
            marginBottom: 20,
            paddingBottom: 16,
            borderBottom: '1px solid var(--border)'
          }}>
            <div style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              background: 'linear-gradient(135deg, var(--accent-2), #5b9cff)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 20,
              flexShrink: 0
            }}>
              🎯
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, opacity: 0.5, marginBottom: 2 }}>{active.loId}</div>
              <h2 style={{
                fontWeight: 800,
                margin: 0,
                fontSize: 18,
                lineHeight: 1.3,
                wordBreak: 'break-word'
              }}>{active.loTitle}</h2>
              <p style={{
                opacity: 0.7,
                fontSize: 13,
                margin: '6px 0 0',
                lineHeight: 1.5
              }}>{active.oneLineGist}</p>
            </div>
            <button
              onClick={() => handleToggleComplete(active.loId)}
              style={{
                flexShrink: 0,
                padding: '8px 14px',
                borderRadius: 10,
                border: 'none',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: 13,
                transition: 'all 0.15s ease',
                background: completedSet.has(active.loId) ? '#22c55e' : 'var(--border)',
                color: completedSet.has(active.loId) ? 'white' : 'var(--text)',
                whiteSpace: 'nowrap'
              }}
            >
              {completedSet.has(active.loId) ? '✓ Done' : 'Complete'}
            </button>
          </div>

          {/* Content Sections */}
          <Section id="core" title="Core Ideas" icon="💡">
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {active.coreIdeas.map((idea, i) => (
                <li key={i} style={{ fontSize: 14, marginBottom: 8, lineHeight: 1.6 }}>{idea}</li>
              ))}
            </ul>
          </Section>

          <Section id="remember" title="Must Remember" icon="⚡">
            {active.mustRemember.map((item, i) => (
              <div key={i} style={{
                padding: '10px 12px',
                marginBottom: 8,
                borderRadius: 8,
                borderLeft: '3px solid var(--accent-2)',
                background: 'rgba(0,122,255,0.04)',
                fontSize: 13,
                lineHeight: 1.6
              }}>
                {item}
              </div>
            ))}
          </Section>

          <Section id="intuitive" title="Intuitive Explanation" icon="🧠">
            <p style={{ fontSize: 14, lineHeight: 1.8, margin: 0 }}>{active.intuitiveExplanation}</p>
          </Section>

          {active.examples?.length > 0 && (
            <Section id="examples" title="Examples" icon="📝">
              {active.examples.map((ex, i) => (
                <div key={i} style={{
                  padding: '12px 14px',
                  marginBottom: 8,
                  borderRadius: 10,
                  background: 'var(--bg)',
                  border: '1px solid var(--border)'
                }}>
                  <div style={{ fontWeight: 600, marginBottom: 4, fontSize: 13 }}>{ex.label}</div>
                  <div style={{ fontSize: 13, opacity: 0.8, lineHeight: 1.5 }}>{ex.description}</div>
                </div>
              ))}
            </Section>
          )}

          {active.typicalQuestions?.length > 0 && (
            <Section id="questions" title="Typical Questions" icon="❓">
              <ol style={{ margin: 0, paddingLeft: 18 }}>
                {active.typicalQuestions.map((q, i) => (
                  <li key={i} style={{ fontSize: 14, marginBottom: 8, lineHeight: 1.6 }}>{q}</li>
                ))}
              </ol>
            </Section>
          )}

          {active.commonTraps?.length > 0 && (
            <Section id="traps" title="Common Mistakes" icon="⚠️">
              {active.commonTraps.map((trap, i) => (
                <div key={i} style={{
                  padding: '10px 12px',
                  marginBottom: 8,
                  borderRadius: 8,
                  borderLeft: '3px solid #ef4444',
                  background: 'rgba(239,68,68,0.04)',
                  fontSize: 13,
                  lineHeight: 1.6
                }}>
                  {trap}
                </div>
              ))}
            </Section>
          )}

          {/* Mini Quiz */}
          {active.miniQuiz?.length > 0 && (
            <Section id="quiz" title="Mini Quiz" icon="🎯">
              {active.miniQuiz.map((q, i) => (
                <div key={i} style={{
                  padding: 14,
                  marginBottom: 10,
                  borderRadius: 12,
                  background: 'var(--bg)',
                  border: '1px solid var(--border)'
                }}>
                  <div style={{ display: 'flex', gap: 10, marginBottom: 12, alignItems: 'flex-start' }}>
                    <span style={{
                      width: 24,
                      height: 24,
                      borderRadius: 6,
                      background: 'var(--accent-2)',
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 12,
                      fontWeight: 700,
                      flexShrink: 0
                    }}>
                      {i + 1}
                    </span>
                    <p style={{ fontWeight: 600, margin: 0, fontSize: 14, lineHeight: 1.5 }}>{q.question}</p>
                  </div>

                  <button
                    onClick={() => toggleQuizAnswer(i)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 8,
                      border: '1px solid var(--border)',
                      background: 'var(--card)',
                      cursor: 'pointer',
                      fontSize: 12,
                      fontWeight: 500,
                      marginBottom: quizRevealed[i] ? 12 : 0
                    }}
                  >
                    {quizRevealed[i] ? 'Hide Answer' : 'Show Answer'}
                  </button>

                  {quizRevealed[i] && (
                    <div style={{
                      padding: '10px 12px',
                      borderRadius: 8,
                      background: 'rgba(34,197,94,0.06)',
                      marginTop: 8
                    }}>
                      <div style={{ marginBottom: 6 }}>
                        <span style={{ fontWeight: 600, color: '#22c55e' }}>✓ Answer: </span>
                        <span style={{ fontSize: 13 }}>{q.answer}</span>
                      </div>
                      <div>
                        <span style={{ fontWeight: 600, color: 'var(--accent-2)' }}>💡 Why: </span>
                        <span style={{ fontSize: 13, opacity: 0.8 }}>{q.why}</span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </Section>
          )}
        </div>
      )}
    </div>
  );
}
