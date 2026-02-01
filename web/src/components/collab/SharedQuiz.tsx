import React, { useEffect, useState } from "react";
import { useRoomStore } from "../../stores/roomStore";
import { lessonsApi, quizApi, LessonData } from "../../services/api";
import { Plan } from "../../types";

interface QuizAnswer {
  question: string;
  answer: string;
  explanation?: string;
}

export default function SharedQuiz() {
  const currentRoom = useRoomStore((s) => s.currentRoom);
  const lessonId = currentRoom?.lessonId || "";
  const lessonTitle = currentRoom?.lessonTitle || "Lesson";

  const [lesson, setLesson] = useState<LessonData | null>(null);
  const [questions, setQuestions] = useState<string[]>([]);
  const [answers, setAnswers] = useState<QuizAnswer[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingAns, setLoadingAns] = useState(false);
  const [revealedIdx, setRevealedIdx] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!lessonId) return;
    lessonsApi.getById(lessonId).then((data) => {
      if (data) setLesson(data);
    });
  }, [lessonId]);

  const handleGenerate = async () => {
    if (!lesson?.plan) {
      setError("No plan found for this lesson. Generate a plan first.");
      return;
    }
    setLoading(true);
    setError(null);
    setQuestions([]);
    setAnswers([]);
    setRevealedIdx(new Set());
    try {
      const res = await quizApi.generateFromPlan(lesson.plan);
      if (res.ok && res.questions) {
        setQuestions(res.questions);
      } else {
        setError(res.error || "Failed to generate questions.");
      }
    } catch {
      setError("Network error generating quiz.");
    }
    setLoading(false);
  };

  const handleGetAnswers = async () => {
    if (!questions.length || !lesson) return;
    setLoadingAns(true);
    try {
      const res = await quizApi.getAnswers({
        questions,
        lectureText: lesson.transcript || "",
        slidesText: lesson.slideText || "",
        plan: lesson.plan || null,
      });
      if (res.ok && res.answers) {
        setAnswers(
          (res.answers as { answer?: string; explanation?: string }[]).map((a, i) => ({
            question: questions[i],
            answer: a.answer || "",
            explanation: a.explanation || "",
          }))
        );
      }
    } catch {
      setError("Failed to fetch answers.");
    }
    setLoadingAns(false);
  };

  const toggleReveal = (idx: number) => {
    setRevealedIdx((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Header */}
      <div className="ws-pane-head" style={{ padding: "14px 18px", borderBottom: "1px solid var(--ws-sidebar-border, var(--border))" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Quiz</div>
            <div className="small muted">{lessonTitle}</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {questions.length > 0 && answers.length === 0 && (
              <button className="btn btn-secondary" onClick={handleGetAnswers} disabled={loadingAns} style={{ fontSize: 12, padding: "5px 12px" }}>
                {loadingAns ? "Loading..." : "Show Answers"}
              </button>
            )}
            <button className="btn" onClick={handleGenerate} disabled={loading} style={{ fontSize: 12, padding: "5px 12px" }}>
              {loading ? "Generating..." : questions.length > 0 ? "Regenerate" : "Generate Quiz"}
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: "auto", padding: "14px 18px" }}>
        {error && (
          <div className="muted-block" style={{ color: "var(--danger)", marginBottom: 12 }}>
            {error}
          </div>
        )}

        {!questions.length && !loading && (
          <div className="pane-empty">
            <div className="pane-empty__icon">{"?"}</div>
            <div className="pane-empty__title">Generate a Quiz</div>
            <div className="pane-empty__desc">
              Quiz questions will be generated from the room's lesson plan. Click "Generate Quiz" to start.
            </div>
          </div>
        )}

        {loading && (
          <div className="pane-empty" style={{ padding: 24 }}>
            <div className="pane-empty__desc">Generating questions...</div>
          </div>
        )}

        {questions.length > 0 && (
          <div style={{ display: "grid", gap: 10 }}>
            {questions.map((q, i) => {
              const ans = answers[i];
              const revealed = revealedIdx.has(i);
              return (
                <div key={i} className="card" style={{ padding: "12px 16px" }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <span
                      style={{
                        flexShrink: 0,
                        width: 28,
                        height: 28,
                        borderRadius: "50%",
                        background: "var(--accent-2)",
                        color: "white",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 700,
                        fontSize: 13,
                      }}
                    >
                      {i + 1}
                    </span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>{q}</div>
                      {ans && (
                        <div>
                          <button
                            className="btn-small"
                            onClick={() => toggleReveal(i)}
                            style={{ fontSize: 11, marginBottom: 6 }}
                          >
                            {revealed ? "Hide Answer" : "Reveal Answer"}
                          </button>
                          {revealed && (
                            <div style={{ fontSize: 13, color: "var(--text)", background: "var(--bg)", padding: "8px 12px", borderRadius: 8, marginTop: 4 }}>
                              <div><strong>Answer:</strong> {ans.answer}</div>
                              {ans.explanation && (
                                <div style={{ marginTop: 4, color: "var(--muted)", fontSize: 12 }}>
                                  {ans.explanation}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
