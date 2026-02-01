import React, { useEffect, useRef } from "react";
import { useRoomStore } from "../../stores/roomStore";
import { useSprintStore } from "../../stores/sprintStore";

export default function SharedSprint() {
  const currentRoom = useRoomStore((s) => s.currentRoom);
  const participants = useRoomStore((s) => s.participants);
  const lessonId = currentRoom?.lessonId || "";
  const lessonTitle = currentRoom?.lessonTitle || "Lesson";

  const {
    settings,
    timerSeconds,
    timerRunning,
    timerPhase,
    currentSession,
    stats,
    focus,
    fetchSettings,
    fetchStats,
    fetchFocus,
    startSession,
    endSession,
    setTimerSeconds,
    setTimerRunning,
    completePomodoroRound,
  } = useSprintStore();

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetchSettings();
    fetchStats();
    if (lessonId) fetchFocus(lessonId);
  }, [lessonId]);

  // Timer interval
  useEffect(() => {
    if (timerRunning && timerSeconds > 0) {
      intervalRef.current = setInterval(() => {
        setTimerSeconds(useSprintStore.getState().timerSeconds - 1);
      }, 1000);
    } else if (timerSeconds <= 0 && timerRunning) {
      completePomodoroRound();
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [timerRunning, timerSeconds]);

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  // SVG circular timer
  const radius = 90;
  const circumference = 2 * Math.PI * radius;
  const totalSeconds =
    timerPhase === "study"
      ? settings.studyDurationMin * 60
      : timerPhase === "break"
        ? settings.breakDurationMin * 60
        : settings.studyDurationMin * 60;
  const progress = totalSeconds > 0 ? timerSeconds / totalSeconds : 0;
  const strokeDashoffset = circumference * (1 - progress);

  const phaseColor =
    timerPhase === "study" ? "var(--accent-2)" : timerPhase === "break" ? "var(--success)" : "var(--muted)";
  const phaseLabel =
    timerPhase === "study" ? "Study" : timerPhase === "break" ? "Break" : "Ready";

  const sprintParticipants = participants.filter((p) => p.activeTool === "sprint");

  const handleStart = () => {
    startSession(lessonId || undefined);
  };

  const handlePause = () => {
    setTimerRunning(!timerRunning);
  };

  const handleEnd = () => {
    endSession();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Header */}
      <div className="ws-pane-head" style={{ padding: "14px 18px", borderBottom: "1px solid var(--ws-sidebar-border, var(--border))" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Sprint Timer</div>
            <div className="small muted">{lessonTitle}</div>
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span className="small muted">
              {settings.studyDurationMin}m study / {settings.breakDurationMin}m break
            </span>
          </div>
        </div>
      </div>

      {/* Timer */}
      <div style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column", alignItems: "center", padding: "24px 18px", gap: 20 }}>
        {/* Circular Timer */}
        <div style={{ position: "relative", width: 220, height: 220 }}>
          <svg width="220" height="220" viewBox="0 0 220 220" style={{ transform: "rotate(-90deg)" }}>
            <circle cx="110" cy="110" r={radius} fill="none" stroke="var(--border)" strokeWidth="8" />
            <circle
              cx="110"
              cy="110"
              r={radius}
              fill="none"
              stroke={phaseColor}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              style={{ transition: "stroke-dashoffset 0.5s ease" }}
            />
          </svg>
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div style={{ fontSize: 36, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>
              {formatTime(timerSeconds)}
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: phaseColor, textTransform: "uppercase" }}>
              {phaseLabel}
            </div>
            {currentSession && (
              <div className="small muted" style={{ marginTop: 4 }}>
                Pomodoro #{currentSession.pomodorosCompleted + 1}
              </div>
            )}
          </div>
        </div>

        {/* Controls */}
        <div style={{ display: "flex", gap: 10 }}>
          {!currentSession ? (
            <button className="btn" onClick={handleStart} style={{ padding: "8px 24px" }}>
              Start Sprint
            </button>
          ) : (
            <>
              <button className="btn btn-secondary" onClick={handlePause} style={{ padding: "8px 20px" }}>
                {timerRunning ? "Pause" : "Resume"}
              </button>
              <button
                className="btn"
                onClick={handleEnd}
                style={{ padding: "8px 20px", background: "var(--danger)", borderColor: "var(--danger)" }}
              >
                End
              </button>
            </>
          )}
        </div>

        {/* Studying now */}
        {sprintParticipants.length > 0 && (
          <div style={{ width: "100%", maxWidth: 360 }}>
            <div className="small muted" style={{ marginBottom: 8 }}>
              Studying now ({sprintParticipants.length})
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {sprintParticipants.map((p) => (
                <div
                  key={p.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "4px 10px",
                    borderRadius: 20,
                    background: "var(--bg)",
                    border: "1px solid var(--border)",
                    fontSize: 12,
                  }}
                >
                  <div
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: "50%",
                      background: p.avatar || "#3b82f6",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "white",
                      fontSize: 10,
                      fontWeight: 700,
                    }}
                  >
                    {p.nickname.charAt(0).toUpperCase()}
                  </div>
                  {p.nickname}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Stats & Focus */}
        <div style={{ width: "100%", maxWidth: 360, display: "grid", gap: 10 }}>
          {stats && (
            <div className="card" style={{ padding: "10px 14px", display: "flex", justifyContent: "space-around", textAlign: "center" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 18 }}>{stats.totalPomodoros}</div>
                <div className="small muted">Pomodoros</div>
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 18 }}>{stats.totalStudyMinutes}m</div>
                <div className="small muted">Study Time</div>
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 18 }}>{stats.totalSessions}</div>
                <div className="small muted">Sessions</div>
              </div>
            </div>
          )}

          {focus && focus.weakTopics.length > 0 && (
            <div className="card" style={{ padding: "10px 14px" }}>
              <div className="small" style={{ fontWeight: 600, marginBottom: 6 }}>Focus Areas</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {focus.weakTopics.slice(0, 5).map((t, i) => (
                  <span
                    key={i}
                    style={{
                      fontSize: 11,
                      padding: "3px 8px",
                      borderRadius: 6,
                      background: "var(--warning-bg, rgba(245,158,11,0.1))",
                      color: "var(--warning)",
                      border: "1px solid var(--warning)",
                    }}
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
