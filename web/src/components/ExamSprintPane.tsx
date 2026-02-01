import React, { useEffect, useRef, useCallback } from "react";
import { useSprintStore } from "../stores/sprintStore";
import { useLessonStore } from "../stores/lessonStore";

function CircularTimer({
  seconds,
  total,
  phase,
}: {
  seconds: number;
  total: number;
  phase: "study" | "break" | "idle";
}) {
  const radius = 80;
  const circumference = 2 * Math.PI * radius;
  const progress = total > 0 ? seconds / total : 0;
  const offset = circumference * (1 - progress);
  const color =
    phase === "study"
      ? "var(--accent-2)"
      : phase === "break"
        ? "var(--success)"
        : "var(--muted)";

  const mm = Math.floor(seconds / 60);
  const ss = seconds % 60;

  return (
    <svg width="200" height="200" viewBox="0 0 200 200">
      {/* Background circle */}
      <circle
        cx="100" cy="100" r={radius}
        fill="none" stroke="var(--hair)" strokeWidth="6"
      />
      {/* Progress arc */}
      <circle
        cx="100" cy="100" r={radius}
        fill="none" stroke={color} strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform="rotate(-90 100 100)"
        style={{ transition: "stroke-dashoffset 1s linear" }}
      />
      {/* Timer text */}
      <text
        x="100" y="88"
        textAnchor="middle" fill="var(--text)"
        fontSize="38" fontWeight="800"
        fontFamily="-apple-system, BlinkMacSystemFont, system-ui, sans-serif"
      >
        {mm}:{String(ss).padStart(2, "0")}
      </text>
      <text
        x="100" y="118"
        textAnchor="middle" fill={color}
        fontSize="12" fontWeight="600"
        letterSpacing="0.1em"
      >
        {phase === "study" ? "STUDYING" : phase === "break" ? "BREAK TIME" : "READY"}
      </text>
    </svg>
  );
}

function ExamCountdown({ examDate }: { examDate: string }) {
  const now = new Date();
  const exam = new Date(examDate);
  const diff = exam.getTime() - now.getTime();

  if (diff <= 0) {
    return (
      <div className="sprint-countdown sprint-countdown--urgent">
        <div className="sprint-countdown__label" style={{ color: "var(--danger)" }}>EXAM</div>
        <div className="sprint-countdown__value" style={{ color: "var(--danger)" }}>
          NOW
        </div>
      </div>
    );
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const isUrgent = days < 2;

  return (
    <div className={`sprint-countdown${isUrgent ? " sprint-countdown--urgent" : ""}`}>
      <div className="sprint-countdown__label">Exam Countdown</div>
      <div
        className="sprint-countdown__value"
        style={{ color: isUrgent ? "var(--danger)" : "var(--accent-2)" }}
      >
        {days}d {hours}h
      </div>
      {isUrgent && (
        <div
          className="sprint-countdown__alert"
          style={{ background: "var(--danger-bg)", color: "var(--danger)" }}
        >
          Intensive mode recommended
        </div>
      )}
    </div>
  );
}

export default function ExamSprintPane() {
  const {
    settings,
    currentSession,
    stats,
    focus,
    timerSeconds,
    timerRunning,
    timerPhase,
    loading,
    fetchSettings,
    updateSettings,
    startSession,
    endSession,
    fetchStats,
    fetchFocus,
    setTimerSeconds,
    setTimerRunning,
    setTimerPhase,
    completePomodoroRound,
  } = useSprintStore();

  const currentLessonId = useLessonStore((s) => s.currentLessonId);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetchSettings();
    fetchStats();
    if (currentLessonId) fetchFocus(currentLessonId);
  }, [currentLessonId]);

  // Timer tick
  useEffect(() => {
    if (timerRunning && timerSeconds > 0) {
      intervalRef.current = setInterval(() => {
        setTimerSeconds(timerSeconds - 1);
      }, 1000);
    } else if (timerSeconds <= 0 && timerRunning) {
      completePomodoroRound();
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [timerRunning, timerSeconds]);

  const totalSeconds =
    timerPhase === "study"
      ? settings.studyDurationMin * 60
      : timerPhase === "break"
        ? settings.breakDurationMin * 60
        : settings.studyDurationMin * 60;

  const handleStart = useCallback(() => {
    startSession(currentLessonId || undefined);
  }, [currentLessonId]);

  const handlePause = useCallback(() => {
    setTimerRunning(!timerRunning);
  }, [timerRunning]);

  const handleReset = useCallback(() => {
    setTimerRunning(false);
    setTimerPhase("idle");
    setTimerSeconds(settings.studyDurationMin * 60);
  }, [settings.studyDurationMin]);

  const handleSkipBreak = useCallback(() => {
    if (timerPhase === "break") {
      setTimerPhase("study");
      setTimerSeconds(settings.studyDurationMin * 60);
      setTimerRunning(true);
    }
  }, [timerPhase, settings.studyDurationMin]);

  return (
    <div className="grid-gap-12">
      {/* Header */}
      <section className="lc-section">
        <div className="pane-header">
          <div className="pane-header__info">
            <div className="pane-header__title">Exam Sprint</div>
            <div className="pane-header__desc">
              Pomodoro-powered study sessions with focus materials.
            </div>
          </div>
        </div>
      </section>

      {/* Timer + Controls */}
      <section className="lc-section">
        <div className="sprint-timer-wrap">
          <CircularTimer seconds={timerSeconds} total={totalSeconds} phase={timerPhase} />

          <div className="sprint-controls">
            {!currentSession ? (
              <button className="btn" onClick={handleStart} disabled={loading}>
                {loading ? "Starting..." : "Start Sprint"}
              </button>
            ) : (
              <>
                <button className="btn" onClick={handlePause}>
                  {timerRunning ? "Pause" : "Resume"}
                </button>
                {timerPhase === "break" && (
                  <button className="btn-small" onClick={handleSkipBreak}>
                    Skip Break
                  </button>
                )}
                <button className="btn-small" onClick={handleReset}>
                  Reset
                </button>
                <button
                  className="btn"
                  style={{ background: "var(--danger)", color: "#fff", borderColor: "var(--danger)" }}
                  onClick={endSession}
                >
                  End Session
                </button>
              </>
            )}
          </div>

          {currentSession && (
            <div className="sprint-pomodoro-count">
              Pomodoros: <strong>{currentSession.pomodorosCompleted}</strong>
            </div>
          )}
        </div>
      </section>

      {/* Settings */}
      <section className="lc-section">
        <div className="wk-section-title">Settings</div>
        <div className="sprint-settings-grid">
          <div className="sprint-setting-row">
            <span className="sprint-setting-label">Study duration (min)</span>
            <input
              type="number"
              className="sprint-setting-input"
              value={settings.studyDurationMin}
              onChange={(e) =>
                updateSettings({ studyDurationMin: Math.max(5, parseInt(e.target.value) || 25) })
              }
            />
          </div>
          <div className="sprint-setting-row">
            <span className="sprint-setting-label">Break duration (min)</span>
            <input
              type="number"
              className="sprint-setting-input"
              value={settings.breakDurationMin}
              onChange={(e) =>
                updateSettings({ breakDurationMin: Math.max(1, parseInt(e.target.value) || 5) })
              }
            />
          </div>
          <div className="sprint-setting-row">
            <span className="sprint-setting-label">Exam date</span>
            <input
              type="date"
              className="sprint-setting-input sprint-setting-input--date"
              value={settings.examDate || ""}
              onChange={(e) => updateSettings({ examDate: e.target.value || undefined })}
            />
          </div>
        </div>
      </section>

      {/* Exam Countdown */}
      {settings.examDate && <ExamCountdown examDate={settings.examDate} />}

      {/* Focus Panel */}
      {focus && currentSession && (
        <section className="lc-section">
          <div className="wk-section-title">Study Focus</div>

          {focus.weakTopics.length > 0 && (
            <div className="sprint-focus-block">
              <div className="sprint-focus-label sprint-focus-label--danger">
                Weak Topics to Review
              </div>
              <ul className="sprint-focus-list">
                {focus.weakTopics.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            </div>
          )}

          {focus.dueFlashcards > 0 && (
            <div className="sprint-focus-block">
              <div className="sprint-focus-label sprint-focus-label--info">
                {focus.dueFlashcards} flashcard{focus.dueFlashcards > 1 ? "s" : ""} due for review
              </div>
            </div>
          )}

          {focus.cheatHighlights.length > 0 && (
            <div className="sprint-focus-block">
              <div className="sprint-focus-label sprint-focus-label--default">
                Key Points
              </div>
              <ul className="sprint-focus-list">
                {focus.cheatHighlights.map((h, i) => (
                  <li key={i}>{h}</li>
                ))}
              </ul>
            </div>
          )}

          {focus.emphases.length > 0 && (
            <div className="sprint-focus-block">
              <div className="sprint-focus-label sprint-focus-label--default">
                Professor Emphases
              </div>
              <ul className="sprint-focus-list">
                {focus.emphases.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {/* Stats */}
      {stats && (
        <section className="lc-section">
          <div className="wk-section-title">Sprint Stats</div>
          <div className="sprint-stat-grid">
            <div className="sprint-stat-card">
              <div className="sprint-stat-value" style={{ color: "var(--accent-2)" }}>
                {stats.totalSessions}
              </div>
              <div className="sprint-stat-label">Sessions</div>
            </div>
            <div className="sprint-stat-card">
              <div className="sprint-stat-value" style={{ color: "var(--success)" }}>
                {stats.totalPomodoros}
              </div>
              <div className="sprint-stat-label">Pomodoros</div>
            </div>
            <div className="sprint-stat-card">
              <div className="sprint-stat-value" style={{ color: "var(--warning)" }}>
                {stats.totalStudyMinutes}m
              </div>
              <div className="sprint-stat-label">Study Time</div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
