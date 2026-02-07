import React, { useEffect, useState, useCallback, useRef } from "react";
import { useCourseStore } from "../stores/courseStore";
import { useLessonStore } from "../stores/lessonStore";
import { useUiStore } from "../stores/uiStore";
import { courseApi } from "../services/api";
import { Course, CourseProgress, WeeklySchedule, ModeId } from "../types";
import { motion, AnimatePresence } from "framer-motion";

const CHAT_STORAGE_PREFIX = 'lc.course-chat.';

// ---- Create Course Modal ----
function CreateCourseModal({ onClose }: { onClose: () => void }) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const createCourse = useCourseStore((s) => s.createCourse);

  const handleCreate = async () => {
    if (!code.trim() || !name.trim()) return;
    await createCourse(code.trim(), name.trim(), desc.trim() || undefined);
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
        <div className="modal-title h3 mb-4">Create New Course</div>
        <label className="label">Course Code</label>
        <input
          autoFocus
          className="lc-textarea input mb-3 w-full"
          placeholder="Ex: MATH 201"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCreate()}
        />
        <label className="label">Course Name</label>
        <input
          className="lc-textarea input mb-3 w-full"
          placeholder="Ex: Linear Algebra"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCreate()}
        />
        <label className="label">Description (optional)</label>
        <textarea
          className="lc-textarea textarea mb-3 w-full"
          placeholder="Brief course description..."
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          rows={2}
        />
        <div className="modal-actions flex justify-end gap-2">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleCreate} disabled={!code.trim() || !name.trim()}>
            Create Course
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- Assign Lesson Modal ----
function AssignLessonModal({ course, onClose }: { course: Course; onClose: () => void }) {
  const lessons = useLessonStore((s) => s.lessons);
  const addLesson = useCourseStore((s) => s.addLessonToCourse);
  const unassigned = lessons.filter((l) => !course.lessonIds.includes(l.id));

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
        <div className="modal-title h3 mb-4">Add Lesson to {course.code}</div>
        {unassigned.length === 0 ? (
          <p className="muted">All lessons are already assigned to this course.</p>
        ) : (
          <div style={{ display: "grid", gap: 6, maxHeight: 300, overflowY: "auto" }}>
            {unassigned.map((l) => (
              <button
                key={l.id}
                className="btn btn-ghost"
                style={{ textAlign: "left", justifyContent: "flex-start" }}
                onClick={async () => {
                  await addLesson(course.id, l.id);
                  onClose();
                }}
              >
                {l.title}
              </button>
            ))}
          </div>
        )}
        <div className="modal-actions flex justify-end gap-2 mt-4">
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

// ---- Coverage badge ----
function CoverageBadge({ level }: { level: "full" | "partial" | "none" }) {
  const colors: Record<string, string> = {
    full: "var(--success, #22c55e)",
    partial: "var(--warning, #eab308)",
    none: "var(--danger, #ef4444)",
  };
  return (
    <span
      style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: colors[level], marginRight: 6 }}
      title={level}
    />
  );
}

// ---- Progress Bar ----
function ProgressBar({ value, max, color, label }: { value: number; max: number; color: string; label?: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div style={{ flex: 1 }}>
      {label && <div className="small muted" style={{ marginBottom: 2 }}>{label}</div>}
      <div style={{ height: 8, background: "var(--hair)", borderRadius: 4, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 4, transition: "width 0.3s" }} />
      </div>
      <div className="small muted" style={{ marginTop: 2 }}>{pct}%</div>
    </div>
  );
}

// ---- Markdown-like formatter for chat ----
function formatChatLine(text: string, keyPrefix: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*(.+?)\*\*|`(.+?)`)/g;
  let lastIndex = 0;
  let match;
  let partIdx = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    if (match[2]) parts.push(<strong key={`${keyPrefix}-b${partIdx++}`}>{match[2]}</strong>);
    else if (match[3]) parts.push(<code key={`${keyPrefix}-c${partIdx++}`} style={{ background: 'var(--hair)', padding: '2px 6px', borderRadius: 4, fontSize: 12 }}>{match[3]}</code>);
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts.length > 0 ? parts : [text];
}

function formatChatMessage(content: string) {
  return content.split('\n').map((line, i) => {
    if (line.startsWith('- ') || line.startsWith('• ')) {
      return <div key={i} style={{ paddingLeft: 16, marginBottom: 4 }}>{'• '}{formatChatLine(line.slice(2), `cl${i}`)}</div>;
    }
    if (!line.trim()) return <div key={i} style={{ marginBottom: 4 }}>{'\u00A0'}</div>;
    return <div key={i} style={{ marginBottom: 4 }}>{formatChatLine(line, `cl${i}`)}</div>;
  });
}

// ---- Main Dashboard ----
export default function CourseDashboard() {
  const courses = useCourseStore((s) => s.courses);
  const currentCourseId = useCourseStore((s) => s.currentCourseId);
  const fetchCourses = useCourseStore((s) => s.fetchCourses);
  const selectCourse = useCourseStore((s) => s.selectCourse);
  const deleteCourse = useCourseStore((s) => s.deleteCourse);
  const rebuildIndex = useCourseStore((s) => s.rebuildIndex);
  const removeLessonFromCourse = useCourseStore((s) => s.removeLessonFromCourse);
  const courseProgress = useCourseStore((s) => s.courseProgress);
  const weeklySchedule = useCourseStore((s) => s.weeklySchedule);
  const progressLoading = useCourseStore((s) => s.progressLoading);
  const scheduleLoading = useCourseStore((s) => s.scheduleLoading);
  const fetchCourseProgress = useCourseStore((s) => s.fetchCourseProgress);
  const generateWeeklySchedule = useCourseStore((s) => s.generateWeeklySchedule);
  const exportCourse = useCourseStore((s) => s.exportCourse);
  const setMode = useUiStore((s) => s.setMode);
  const setCurrentLessonId = useLessonStore((s) => s.setCurrentLessonId);
  const allLessons = useLessonStore((s) => s.lessons);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatHistory, setChatHistory] = useState<Array<{ role: string; content: string; suggestions?: string[] }>>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "progress" | "schedule">("overview");
  const chatBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchCourses();
  }, []);

  const course = courses.find((c) => c.id === currentCourseId) || null;
  const ki = course?.knowledgeIndex;

  // Load chat history from localStorage on course change
  useEffect(() => {
    if (!course) return;
    const saved = localStorage.getItem(CHAT_STORAGE_PREFIX + course.id);
    if (saved) {
      try { setChatHistory(JSON.parse(saved)); } catch { setChatHistory([]); }
    } else {
      setChatHistory([]);
    }
  }, [course?.id]);

  // Save chat history to localStorage
  useEffect(() => {
    if (!course || chatHistory.length === 0) return;
    localStorage.setItem(CHAT_STORAGE_PREFIX + course.id, JSON.stringify(chatHistory));
  }, [chatHistory, course?.id]);

  // Fetch progress when course is selected
  useEffect(() => {
    if (course) fetchCourseProgress(course.id);
  }, [course?.id]);

  // Auto-scroll chat
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, chatLoading]);

  // Navigate to a lesson
  const goToLesson = useCallback(
    (lessonId: string, mode: ModeId = "plan") => {
      setCurrentLessonId(lessonId);
      setMode(mode);
    },
    [setCurrentLessonId, setMode]
  );

  // Course chat handler
  const handleCourseChat = useCallback(async (customMsg?: string) => {
    const msg = (customMsg || chatInput).trim();
    if (!msg || !course) return;
    setChatInput("");
    setChatHistory((h) => [...h, { role: "user", content: msg }]);
    setChatLoading(true);
    try {
      const result = await courseApi.courseChat(course.id, msg, chatHistory);
      if (result.ok && result.text) {
        setChatHistory((h) => [...h, { role: "assistant", content: result.text!, suggestions: result.suggestions }]);
      }
    } catch { /* ignore */ }
    setChatLoading(false);
  }, [chatInput, course, chatHistory]);

  const clearChat = useCallback(() => {
    setChatHistory([]);
    if (course) localStorage.removeItem(CHAT_STORAGE_PREFIX + course.id);
  }, [course?.id]);

  // ---- No course selected ----
  if (!course) {
    return (
      <div className="lc-section" style={{ padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 className="h2">Courses</h2>
          <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>+ New Course</button>
        </div>

        {courses.length === 0 ? (
          <div className="muted-block" style={{ padding: 24, textAlign: "center" }}>
            <p style={{ fontSize: 14, marginBottom: 8 }}>No courses yet. Create a course to organize your lessons.</p>
            <p className="muted small">Courses group your lessons together so the AI can make cross-lesson connections.</p>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {courses.map((c) => (
              <div
                key={c.id}
                className="card"
                style={{ padding: "12px 16px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}
                onClick={() => selectCourse(c.id)}
              >
                <div>
                  <div style={{ fontWeight: 600 }}>
                    <span style={{ color: "var(--accent-2)", marginRight: 8 }}>{c.code}</span>
                    {c.name}
                  </div>
                  <div className="muted small">
                    {c.lessonIds.length} lesson{c.lessonIds.length !== 1 ? "s" : ""}
                    {c.settings?.examDate ? ` | Exam: ${c.settings.examDate}` : ""}
                  </div>
                </div>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" opacity={0.4}>
                  <path d="M6 3l5 5-5 5" />
                </svg>
              </div>
            ))}
          </div>
        )}

        {showCreateModal && <CreateCourseModal onClose={() => setShowCreateModal(false)} />}
      </div>
    );
  }

  // ---- Course selected: Dashboard ----
  const courseLessons = course.lessonIds
    .map((id) => allLessons.find((l) => l.id === id))
    .filter(Boolean) as Array<{ id: string; title: string; date: string; plan?: any }>;

  const tabs = [
    { id: "overview" as const, label: "Overview" },
    { id: "progress" as const, label: "Progress" },
    { id: "schedule" as const, label: "Schedule" },
  ];

  return (
    <div className="lc-section" style={{ padding: 24 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
        <div>
          <button className="btn btn-ghost" style={{ marginBottom: 8, padding: "2px 8px", fontSize: 12 }} onClick={() => selectCourse(null)}>
            &larr; All Courses
          </button>
          <h2 className="h2" style={{ marginBottom: 4 }}>
            <span style={{ color: "var(--accent-2)" }}>{course.code}</span> {course.name}
          </h2>
          {course.description && <p className="muted small">{course.description}</p>}
          {course.settings?.examDate && (
            <div className="small" style={{ marginTop: 4, color: "var(--accent-2)" }}>Exam: {course.settings.examDate}</div>
          )}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button className="btn btn-ghost" onClick={() => exportCourse(course.id)} title="Export course data">
            Export
          </button>
          <button className="btn btn-ghost" onClick={() => rebuildIndex(course.id)} title="Rebuild Knowledge Index">
            Rebuild Index
          </button>
          <button
            className="btn btn-ghost"
            style={{ color: "var(--danger, #ef4444)" }}
            onClick={async () => { if (confirm(`Delete course "${course.code}"?`)) await deleteCourse(course.id); }}
          >
            Delete
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 16, borderBottom: "1px solid var(--border)", paddingBottom: 4 }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: "8px 16px", fontSize: 13, fontWeight: 600,
              background: activeTab === tab.id ? "var(--accent-2)" : "transparent",
              color: activeTab === tab.id ? "white" : "var(--text)",
              border: "none", borderRadius: 8, cursor: "pointer",
              transition: "all 0.15s",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && (
        <>
          {/* Stats Row */}
          {ki && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8, marginBottom: 20 }}>
              {[
                { value: ki.overview.totalLessons, label: "Lessons" },
                { value: ki.progressSnapshot.completedLessons, label: "Completed" },
                { value: ki.progressSnapshot.quizAverageScore > 0 ? `${Math.round(ki.progressSnapshot.quizAverageScore * 100)}%` : "-", label: "Quiz Avg" },
                { value: ki.progressSnapshot.flashcardsDue, label: "Cards Due" },
                { value: ki.progressSnapshot.weakTopics.length, label: "Weak Topics" },
              ].map((stat, i) => (
                <div key={i} className="card" style={{ padding: "10px 14px", textAlign: "center" }}>
                  <div style={{ fontSize: 22, fontWeight: 700 }}>{stat.value}</div>
                  <div className="muted small">{stat.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Lesson Timeline */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <h3 className="h3">Lessons</h3>
              <button className="btn btn-ghost" onClick={() => setShowAssignModal(true)}>+ Add Lesson</button>
            </div>
            {courseLessons.length === 0 ? (
              <div className="muted-block" style={{ padding: 16, textAlign: "center" }}>
                <p className="muted">No lessons in this course yet.</p>
              </div>
            ) : (
              <div style={{ display: "grid", gap: 6 }}>
                {courseLessons.map((l, i) => (
                  <div key={l.id} className="card" style={{ padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ cursor: "pointer", flex: 1 }} onClick={() => goToLesson(l.id)}>
                      <span className="muted" style={{ marginRight: 8, fontSize: 12 }}>W{i + 1}</span>
                      <span style={{ fontWeight: 500 }}>{l.title}</span>
                      {l.plan && <span style={{ marginLeft: 8, fontSize: 10, color: "var(--success, #22c55e)" }}>planned</span>}
                    </div>
                    <button
                      className="btn btn-ghost"
                      style={{ fontSize: 11, padding: "2px 6px", color: "var(--muted)" }}
                      onClick={() => removeLessonFromCourse(course.id, l.id)}
                      title="Remove from course"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* LO Coverage */}
          {ki && ki.loCoverage.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <h3 className="h3" style={{ marginBottom: 8 }}>Learning Outcome Coverage</h3>
              <div style={{ display: "grid", gap: 4 }}>
                {ki.loCoverage.map((lo) => (
                  <div key={lo.loId} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                    <CoverageBadge level={lo.coverageLevel} />
                    <span style={{ fontWeight: 500, minWidth: 36 }}>{lo.loId}</span>
                    <span className="muted" style={{ flex: 1 }}>{lo.loTitle.length > 60 ? lo.loTitle.slice(0, 60) + "..." : lo.loTitle}</span>
                    <span className="small muted">{lo.coveredByLessons.length} lesson{lo.coveredByLessons.length !== 1 ? "s" : ""}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Concept Bridges */}
          {ki && ki.conceptBridges.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <h3 className="h3" style={{ marginBottom: 8 }}>Cross-Lesson Concepts</h3>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {ki.conceptBridges.map((b, i) => (
                  <div key={i} className="card" style={{ padding: "6px 12px", fontSize: 12 }} title={b.evolution}>
                    <span style={{ fontWeight: 600 }}>{b.concept}</span>
                    <span className="muted" style={{ marginLeft: 6 }}>W{b.appearsInWeeks.join(", W")}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Course Themes & Weak Topics */}
          {ki && ki.overview.courseThemes.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <h3 className="h3" style={{ marginBottom: 8 }}>Course Themes</h3>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {ki.overview.courseThemes.map((t, i) => (
                  <span key={i} className="conn-lesson-tag">{t}</span>
                ))}
              </div>
            </div>
          )}
          {ki && ki.progressSnapshot.weakTopics.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <h3 className="h3" style={{ marginBottom: 8 }}>Weak Topics</h3>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {ki.progressSnapshot.weakTopics.map((t, i) => (
                  <span key={i} className="conn-lesson-tag" style={{ background: "var(--danger-bg)", color: "var(--danger)" }}>{t}</span>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {activeTab === "progress" && (
        <div>
          {progressLoading ? (
            <div className="muted-block" style={{ padding: 24, textAlign: "center" }}>Loading progress...</div>
          ) : courseProgress ? (
            <>
              {/* Lesson Completion */}
              <div style={{ marginBottom: 20 }}>
                <h3 className="h3" style={{ marginBottom: 8 }}>Lesson Completion</h3>
                <ProgressBar
                  value={courseProgress.completedLessons}
                  max={courseProgress.totalLessons}
                  color="var(--success, #22c55e)"
                  label={`${courseProgress.completedLessons} / ${courseProgress.totalLessons} lessons`}
                />
              </div>

              {/* Per-Lesson Status Table */}
              <div style={{ marginBottom: 20 }}>
                <h3 className="h3" style={{ marginBottom: 8 }}>Per-Lesson Status</h3>
                <div style={{ display: "grid", gap: 6 }}>
                  {courseProgress.lessonStatuses.map((ls, i) => (
                    <div key={ls.lessonId} className="card" style={{ padding: "10px 14px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>
                          <span className="muted" style={{ marginRight: 6 }}>W{i + 1}</span>
                          {ls.title}
                        </div>
                        <div style={{ display: "flex", gap: 6 }}>
                          <span style={{
                            fontSize: 10, padding: "2px 6px", borderRadius: 4,
                            background: ls.hasTranscript ? "var(--success-bg)" : "var(--hair)",
                            color: ls.hasTranscript ? "var(--success)" : "var(--muted)",
                          }}>
                            Transcript
                          </span>
                          <span style={{
                            fontSize: 10, padding: "2px 6px", borderRadius: 4,
                            background: ls.hasPlan ? "var(--success-bg)" : "var(--hair)",
                            color: ls.hasPlan ? "var(--success)" : "var(--muted)",
                          }}>
                            Plan
                          </span>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                        {ls.quizScores.length > 0 && (
                          <div style={{ flex: 1 }}>
                            <div className="small muted" style={{ marginBottom: 2 }}>Quiz Scores</div>
                            <div style={{ display: "flex", gap: 4 }}>
                              {ls.quizScores.map((s, si) => (
                                <div
                                  key={si}
                                  style={{
                                    height: 20, minWidth: 28,
                                    background: s >= 0.7 ? "var(--success)" : s >= 0.4 ? "var(--warning)" : "var(--danger)",
                                    borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center",
                                    fontSize: 10, fontWeight: 700, color: "white",
                                  }}
                                >
                                  {Math.round(s * 100)}%
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {ls.flashcardStats.total > 0 && (
                          <div>
                            <div className="small muted" style={{ marginBottom: 2 }}>Flashcards</div>
                            <div style={{ display: "flex", gap: 4, fontSize: 10 }}>
                              <span style={{ color: "var(--success)" }}>{ls.flashcardStats.graduated}G</span>
                              <span style={{ color: "var(--warning)" }}>{ls.flashcardStats.review}R</span>
                              <span style={{ color: "var(--accent-2)" }}>{ls.flashcardStats.learning}L</span>
                              <span className="muted">{ls.flashcardStats.new}N</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quiz Average */}
              {courseProgress.overallQuizAvg > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <h3 className="h3" style={{ marginBottom: 8 }}>Overall Quiz Average</h3>
                  <ProgressBar
                    value={courseProgress.overallQuizAvg * 100}
                    max={100}
                    color={courseProgress.overallQuizAvg >= 0.7 ? "var(--success)" : courseProgress.overallQuizAvg >= 0.4 ? "var(--warning)" : "var(--danger)"}
                    label={`${Math.round(courseProgress.overallQuizAvg * 100)}%`}
                  />
                </div>
              )}

              {/* Flashcard Summary */}
              {courseProgress.flashcardSummary.total > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <h3 className="h3" style={{ marginBottom: 8 }}>Flashcard Breakdown</h3>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(80px, 1fr))", gap: 8 }}>
                    {[
                      { label: "Total", value: courseProgress.flashcardSummary.total, color: "var(--accent-2)" },
                      { label: "New", value: courseProgress.flashcardSummary.new, color: "var(--muted)" },
                      { label: "Learning", value: courseProgress.flashcardSummary.learning, color: "var(--accent-2)" },
                      { label: "Review", value: courseProgress.flashcardSummary.review, color: "var(--warning)" },
                      { label: "Graduated", value: courseProgress.flashcardSummary.graduated, color: "var(--success)" },
                      { label: "Due", value: courseProgress.flashcardSummary.due, color: "var(--danger)" },
                    ].map((stat, i) => (
                      <div key={i} className="card" style={{ padding: "8px 10px", textAlign: "center" }}>
                        <div style={{ fontSize: 18, fontWeight: 700, color: stat.color }}>{stat.value}</div>
                        <div className="small muted">{stat.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Weak/Strong Topics */}
              {(courseProgress.weakTopics.length > 0 || courseProgress.strongTopics.length > 0) && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
                  {courseProgress.weakTopics.length > 0 && (
                    <div>
                      <h3 className="h3" style={{ marginBottom: 6 }}>Weak Topics</h3>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                        {courseProgress.weakTopics.map((t, i) => (
                          <span key={i} style={{
                            padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600,
                            background: "var(--danger-bg)", color: "var(--danger)",
                          }}>{t}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {courseProgress.strongTopics.length > 0 && (
                    <div>
                      <h3 className="h3" style={{ marginBottom: 6 }}>Strong Topics</h3>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                        {courseProgress.strongTopics.map((t, i) => (
                          <span key={i} style={{
                            padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600,
                            background: "var(--success-bg)", color: "var(--success)",
                          }}>{t}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="muted-block" style={{ padding: 24, textAlign: "center" }}>
              <p className="muted">No progress data available. Add lessons and take quizzes to see your progress.</p>
            </div>
          )}
        </div>
      )}

      {activeTab === "schedule" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h3 className="h3">Weekly Study Schedule</h3>
            <button
              className="btn btn-primary"
              onClick={() => generateWeeklySchedule(course.id, course.settings?.examDate)}
              disabled={scheduleLoading}
              style={{ fontSize: 12 }}
            >
              {scheduleLoading ? "Generating..." : weeklySchedule ? "Regenerate Schedule" : "Generate Schedule"}
            </button>
          </div>

          {scheduleLoading && (
            <div className="muted-block" style={{ padding: 24, textAlign: "center" }}>
              <div style={{ marginBottom: 8 }}>Generating your personalized study schedule...</div>
              <motion.div
                animate={{ opacity: [0.4, 1, 0.4] }}
                transition={{ repeat: Infinity, duration: 1.2 }}
                style={{ fontSize: 24 }}
              >
                📅
              </motion.div>
            </div>
          )}

          {!scheduleLoading && !weeklySchedule && (
            <div className="muted-block" style={{ padding: 24, textAlign: "center" }}>
              <p className="muted">Click "Generate Schedule" to get an AI-powered personalized weekly study plan based on your progress and weak topics.</p>
            </div>
          )}

          {weeklySchedule && !scheduleLoading && (
            <>
              {weeklySchedule.examDate && (
                <div className="small" style={{ marginBottom: 12, color: "var(--accent-2)" }}>
                  Exam: {weeklySchedule.examDate} | Generated: {new Date(weeklySchedule.generatedAt).toLocaleDateString()}
                </div>
              )}

              <div style={{ display: "grid", gap: 8, marginBottom: 16 }}>
                {weeklySchedule.days.map((day, di) => (
                  <div key={di} className="card" style={{ padding: "12px 14px" }}>
                    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8, color: "var(--accent-2)" }}>
                      {day.day}
                    </div>
                    <div style={{ display: "grid", gap: 6 }}>
                      {day.slots.map((slot, si) => (
                        <div
                          key={si}
                          style={{
                            display: "flex", gap: 10, alignItems: "flex-start",
                            padding: "6px 10px", borderRadius: 8,
                            background: "var(--bg)",
                          }}
                        >
                          <span style={{
                            fontSize: 10, fontWeight: 700, minWidth: 60,
                            color: slot.time === "Morning" ? "var(--warning)" : slot.time === "Afternoon" ? "var(--accent-2)" : "var(--success)",
                          }}>
                            {slot.time}
                          </span>
                          <div style={{ flex: 1, fontSize: 12 }}>
                            <div>{slot.activity}</div>
                            {slot.lessonRef && <span className="small muted" style={{ marginLeft: 4 }}>({slot.lessonRef})</span>}
                            {slot.tip && <div className="small muted" style={{ marginTop: 2 }}>{slot.tip}</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {weeklySchedule.tips.length > 0 && (
                <div className="card" style={{ padding: 14 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>Tips</div>
                  <div style={{ display: "grid", gap: 4 }}>
                    {weeklySchedule.tips.map((tip, i) => (
                      <div key={i} style={{ fontSize: 12, display: "flex", gap: 6 }}>
                        <span style={{ color: "var(--accent-2)" }}>•</span>
                        <span>{tip}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Course Chat (always visible) */}
      <div style={{ marginTop: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <h3 className="h3">Course AI Chat</h3>
          {chatHistory.length > 0 && (
            <button
              className="btn btn-ghost"
              onClick={clearChat}
              style={{ fontSize: 11, color: "var(--muted)" }}
            >
              Clear Chat
            </button>
          )}
        </div>
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          {/* Chat messages */}
          <div style={{ maxHeight: 350, overflowY: "auto", padding: 12 }}>
            {chatHistory.length === 0 && (
              <div style={{ textAlign: "center", padding: "16px 0" }}>
                <div className="muted small" style={{ marginBottom: 8 }}>Ask anything about your entire course</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center" }}>
                  {["What are the main themes?", "Which topics should I focus on?", "Help me prepare for the exam"].map((suggestion, i) => (
                    <button
                      key={i}
                      onClick={() => handleCourseChat(suggestion)}
                      style={{
                        padding: "6px 12px", borderRadius: 999, fontSize: 11, fontWeight: 600,
                        background: "var(--bg)", border: "1px solid var(--border)",
                        color: "var(--text)", cursor: "pointer", transition: "all 0.15s",
                      }}
                      onMouseOver={(e) => e.currentTarget.style.borderColor = "var(--accent-2)"}
                      onMouseOut={(e) => e.currentTarget.style.borderColor = "var(--border)"}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <AnimatePresence>
              {chatHistory.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{
                    display: "flex",
                    justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
                    marginBottom: 10,
                  }}
                >
                  <div style={{
                    maxWidth: "85%",
                    padding: "10px 14px",
                    borderRadius: 14,
                    background: msg.role === "user" ? "var(--accent-2)" : "var(--bg)",
                    color: msg.role === "user" ? "white" : "var(--text)",
                    borderBottomRightRadius: msg.role === "user" ? 4 : 14,
                    borderBottomLeftRadius: msg.role === "user" ? 14 : 4,
                    border: msg.role === "user" ? "none" : "1px solid var(--border)",
                    fontSize: 13, lineHeight: 1.6,
                  }}>
                    {msg.role === "user" ? msg.content : formatChatMessage(msg.content)}

                    {/* Suggestion buttons */}
                    {msg.role === "assistant" && msg.suggestions && msg.suggestions.length > 0 && (
                      <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {msg.suggestions.map((s, si) => (
                          <button
                            key={si}
                            onClick={() => handleCourseChat(s)}
                            style={{
                              padding: '4px 10px', borderRadius: 999, fontSize: 10, fontWeight: 600,
                              background: 'var(--card)', border: '1px solid var(--border)',
                              color: 'var(--text)', cursor: 'pointer', transition: 'all 0.15s',
                            }}
                            onMouseOver={(e) => e.currentTarget.style.borderColor = 'var(--accent-2)'}
                            onMouseOut={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
                          >
                            💡 {s}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {chatLoading && (
              <div style={{ display: 'flex', gap: 6, padding: 8 }}>
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    animate={{ scale: [1, 1.2, 1], opacity: [0.4, 1, 0.4] }}
                    transition={{ repeat: Infinity, duration: 0.8, delay: i * 0.15 }}
                    style={{ width: 6, height: 6, background: 'var(--accent-2)', borderRadius: '50%' }}
                  />
                ))}
              </div>
            )}
            <div ref={chatBottomRef} />
          </div>

          {/* Chat input */}
          <div style={{
            padding: "10px 12px",
            borderTop: "1px solid var(--border)",
            display: "flex", gap: 8,
          }}>
            <input
              className="lc-textarea input"
              style={{ flex: 1, marginBottom: 0, height: 38, borderRadius: 19, padding: "0 16px", fontSize: 13 }}
              placeholder="Ask about the entire course..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCourseChat()}
              disabled={chatLoading}
            />
            <button
              className="btn btn-primary"
              onClick={() => handleCourseChat()}
              disabled={!chatInput.trim() || chatLoading}
              style={{
                borderRadius: "50%", width: 38, height: 38, padding: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 16,
              }}
            >
              ➤
            </button>
          </div>
        </div>
      </div>

      {showAssignModal && <AssignLessonModal course={course} onClose={() => setShowAssignModal(false)} />}
    </div>
  );
}
