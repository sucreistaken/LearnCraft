import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { useChannelToolStore } from "../../../stores/channelToolStore";
import { channelToolApi } from "../../../services/channelToolApi";
import { getCollabSocket } from "../../../services/collabSocket";

interface Props {
  channelId: string;
  topic: string;
  serverName: string;
  userId: string;
  nickname: string;
}

const EMPTY_MEMBERS: Record<string, { status: string; lastUpdate: string; nickname: string }> = {};

const formatTime = (s: number): string =>
  `${Math.floor(s / 60)
    .toString()
    .padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

const SPRINT_TEMPLATES = [
  { label: "Klasik", study: 25, break_: 5, desc: "25/5 Pomodoro" },
  { label: "Uzun Odak", study: 50, break_: 10, desc: "50/10 derin \u00E7al\u0131\u015Fma" },
  { label: "Maraton", study: 90, break_: 20, desc: "90/20 uzun oturum" },
];

export default function ChannelSprint({ channelId, topic, userId, nickname }: Props) {
  // Zustand selectors - derive state inline, never call methods in selectors
  const sprint = useChannelToolStore(s => s.dataByChannel[channelId]?.sprint ?? null);
  const updateSprint = useChannelToolStore(s => s.updateSprint);

  // Local state
  const [studyMin, setStudyMin] = useState(25);
  const [breakMin, setBreakMin] = useState(5);
  const [timeLeft, setTimeLeft] = useState(0);
  const [starting, setStarting] = useState(false);

  const notifiedRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Timer logic - calculate timeLeft from sprint data
  useEffect(() => {
    if (!sprint || sprint.phase === "idle" || sprint.phase === "finished") {
      setTimeLeft(0);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    notifiedRef.current = false;

    const tick = () => {
      if (!sprint.currentPhaseStartedAt) {
        setTimeLeft(0);
        return;
      }

      const phaseStart = new Date(sprint.currentPhaseStartedAt).getTime();
      const elapsed = Math.floor((Date.now() - phaseStart) / 1000);
      const duration =
        (sprint.phase === "studying" ? sprint.studyDurationMin : sprint.breakDurationMin) * 60;
      const remaining = Math.max(0, duration - elapsed);
      setTimeLeft(remaining);

      if (remaining === 0 && !notifiedRef.current) {
        notifiedRef.current = true;
        // Browser notification if permitted
        if (Notification.permission === "granted") {
          new Notification("S\u00FCre doldu!", {
            body:
              sprint.phase === "studying"
                ? "Mola zaman\u0131!"
                : "\u00C7al\u0131\u015Fma zaman\u0131!",
          });
        }
      }
    };

    // Initial tick
    tick();

    // Set interval
    intervalRef.current = setInterval(tick, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [sprint?.phase, sprint?.currentPhaseStartedAt, sprint?.studyDurationMin, sprint?.breakDurationMin]);

  // Start sprint
  async function handleStart() {
    if (starting) return;
    setStarting(true);
    try {
      const res = await channelToolApi.startSprint(channelId, studyMin, breakMin, userId, nickname);
      updateSprint(channelId, res.sprint);
      getCollabSocket().emit("tool:sprint:update", {
        channelId,
        sprint: res.sprint,
      });
    } catch (err) {
      console.error("Failed to start sprint:", err);
    } finally {
      setStarting(false);
    }
  }

  // Pause sprint - set phase to idle
  async function handlePause() {
    try {
      const res = await channelToolApi.updateSprintStatus(channelId, userId, nickname, "idle");
      updateSprint(channelId, res.sprint);
      getCollabSocket().emit("tool:sprint:update", {
        channelId,
        sprint: res.sprint,
      });
    } catch (err) {
      console.error("Failed to pause sprint:", err);
    }
  }

  // Resume sprint - set phase to studying
  async function handleResume() {
    try {
      const res = await channelToolApi.updateSprintStatus(channelId, userId, nickname, "studying");
      updateSprint(channelId, res.sprint);
      getCollabSocket().emit("tool:sprint:update", {
        channelId,
        sprint: res.sprint,
      });
    } catch (err) {
      console.error("Failed to resume sprint:", err);
    }
  }

  // Reset sprint
  async function handleReset() {
    try {
      const res = await channelToolApi.updateSprintStatus(channelId, userId, nickname, "idle");
      updateSprint(channelId, res.sprint);
      getCollabSocket().emit("tool:sprint:update", {
        channelId,
        sprint: res.sprint,
      });
    } catch (err) {
      console.error("Failed to reset sprint:", err);
    }
  }

  // Update own member status
  async function handleStatusChange(status: "studying" | "break" | "idle") {
    try {
      const res = await channelToolApi.updateSprintStatus(channelId, userId, nickname, status);
      updateSprint(channelId, res.sprint);
      getCollabSocket().emit("tool:sprint:update", {
        channelId,
        sprint: res.sprint,
      });
    } catch (err) {
      console.error("Failed to update status:", err);
    }
  }

  // Derive members from sprint data
  const members = sprint?.members ?? EMPTY_MEMBERS;
  const memberEntries = Object.entries(members);
  const pomodorosCompleted = sprint?.pomodorosCompleted ?? 0;

  // SVG circular timer constants
  const RADIUS = 90;
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

  // Helper: get initials from nickname
  const getInitials = (name: string) => {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  // Helper: status color
  const statusColor = (status: string) => {
    if (status === "studying") return "var(--accent-2)";
    if (status === "break") return "#22c55e";
    return "var(--border)";
  };

  // Helper: status label
  const statusLabel = (status: string) => {
    if (status === "studying") return "\u00C7al\u0131\u015F\u0131yor";
    if (status === "break") return "Molada";
    return "Bekliyor";
  };

  // Idle / setup state
  if (!sprint || sprint.phase === "idle") {
    return (
      <div className="sh-tool">
        <div className="sh-tool__header">
          <div className="sh-tool__header-left">
            <span>{"\u23F1\uFE0F"}</span>
            <h3 className="sh-main-content__channel-name">Sprint - {topic}</h3>
          </div>
        </div>
        <div className="sh-tool__body">
          <div className="sh-sprint__setup-container">
            {/* Hero area */}
            <div className="sh-sprint__hero">
              <div className="sh-sprint__hero-ring">
                <svg width="200" height="200" viewBox="0 0 200 200">
                  <circle
                    cx="100"
                    cy="100"
                    r={RADIUS}
                    fill="none"
                    stroke="var(--border)"
                    strokeWidth="6"
                    opacity="0.3"
                  />
                </svg>
                <div className="sh-sprint__hero-ring-content">
                  <span className="sh-sprint__hero-icon">{"\u23F1\uFE0F"}</span>
                  <span className="sh-sprint__hero-label">Sprint</span>
                </div>
              </div>
              <h3 className="sh-sprint__hero-title">Sprint Zamanlay{"\u0131"}c{"\u0131"}</h3>
              <p className="sh-sprint__hero-desc">
                Pomodoro tekni{"\u011F"}i ile birlikte odakl{"\u0131"} {"\u00E7"}al{"\u0131"}{"\u015F"}{"\u0131"}n
              </p>
            </div>

            {/* Template cards */}
            <div className="sh-sprint__template-cards">
              {SPRINT_TEMPLATES.map(t => (
                <motion.button
                  key={t.label}
                  className={`sh-sprint__template-card${studyMin === t.study && breakMin === t.break_ ? " sh-sprint__template-card--active" : ""}`}
                  onClick={() => { setStudyMin(t.study); setBreakMin(t.break_); }}
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.97 }}
                >
                  <span className="sh-sprint__template-card-time">
                    {t.study}<span className="sh-sprint__template-card-unit">dk</span>
                  </span>
                  <span className="sh-sprint__template-card-name">{t.label}</span>
                  <span className="sh-sprint__template-card-detail">{t.desc}</span>
                </motion.button>
              ))}
            </div>

            {/* Custom config card */}
            <div className="sh-sprint__config-card">
              <div className="sh-sprint__config-card-header">
                {"\u2699\uFE0F"} {"\u00D6"}zel Ayar
              </div>
              <div className="sh-sprint__config-fields">
                <div className="sh-sprint__config-field">
                  <label className="sh-sprint__config-label">
                    {"\u00C7"}al{"\u0131"}{"\u015F"}ma
                  </label>
                  <div className="sh-sprint__config-input-wrap">
                    <input
                      type="number"
                      className="sh-sprint__config-input"
                      value={studyMin}
                      onChange={e => setStudyMin(Math.max(1, parseInt(e.target.value) || 1))}
                      min={1}
                      max={120}
                    />
                    <span className="sh-sprint__config-unit">dk</span>
                  </div>
                </div>
                <div className="sh-sprint__config-field">
                  <label className="sh-sprint__config-label">Mola</label>
                  <div className="sh-sprint__config-input-wrap">
                    <input
                      type="number"
                      className="sh-sprint__config-input"
                      value={breakMin}
                      onChange={e => setBreakMin(Math.max(1, parseInt(e.target.value) || 1))}
                      min={1}
                      max={60}
                    />
                    <span className="sh-sprint__config-unit">dk</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Start button */}
            <motion.button
              className="sh-sprint__start-btn"
              onClick={handleStart}
              disabled={starting}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
            >
              {starting ? "Ba\u015Flat\u0131l\u0131yor..." : "Sprint Ba\u015Flat"}
            </motion.button>
          </div>

          {/* Show member list even in idle if there are members */}
          {memberEntries.length > 0 && (
            <div className="sh-sprint__members-section">
              <h4 className="sh-sprint__members-heading">
                {"\u00DC"}yeler
                <span className="sh-sprint__members-count">{memberEntries.length}</span>
              </h4>
              <div className="sh-sprint__members-grid">
                {memberEntries.map(([memberId, member]) => (
                  <div key={memberId} className="sh-sprint__member-card">
                    <div className="sh-sprint__member-avatar" style={{ borderColor: statusColor(member.status) }}>
                      {getInitials(member.nickname)}
                      <span
                        className="sh-sprint__member-dot"
                        style={{ background: statusColor(member.status) }}
                      />
                    </div>
                    <span className="sh-sprint__member-name">
                      {member.nickname}
                      {memberId === userId ? " (sen)" : ""}
                    </span>
                    <span className="sh-sprint__member-badge" style={{ color: statusColor(member.status) }}>
                      {statusLabel(member.status)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Active sprint state
  const isStudying = sprint.phase === "studying";
  const isBreak = sprint.phase === "break";
  const isFinished = sprint.phase === "finished";

  // Progress calculation for SVG ring
  const totalDuration = (sprint.phase === "studying" ? sprint.studyDurationMin : sprint.breakDurationMin) * 60;
  const progress = totalDuration > 0 ? timeLeft / totalDuration : 0;
  const dashOffset = CIRCUMFERENCE * (1 - progress);

  // Ring color based on phase
  const ringStroke = isStudying
    ? "url(#studyGradient)"
    : isBreak
      ? "url(#breakGradient)"
      : "var(--border)";

  const phaseGlow = isStudying
    ? "rgba(59, 130, 246, 0.15)"
    : isBreak
      ? "rgba(34, 197, 94, 0.15)"
      : "transparent";

  return (
    <div className="sh-tool">
      {/* Header */}
      <div className="sh-tool__header">
        <div className="sh-tool__header-left">
          <span>{"\u23F1\uFE0F"}</span>
          <h3 className="sh-main-content__channel-name">Sprint - {topic}</h3>
        </div>
        <div className="sh-tool__header-right">
          {pomodorosCompleted > 0 && (
            <div className="sh-sprint__pomodoro-row">
              {Array.from({ length: pomodorosCompleted }, (_, i) => (
                <span key={i} className="sh-sprint__pomodoro-dot sh-sprint__pomodoro-dot--done" />
              ))}
              {/* Current in-progress dot */}
              <span className="sh-sprint__pomodoro-dot" />
            </div>
          )}
          <span className="sh-tool__count">
            {pomodorosCompleted} pomodoro
          </span>
        </div>
      </div>

      <div className="sh-tool__body">
        {/* Circular timer */}
        <div className="sh-sprint__timer-ring-area" style={{ background: `radial-gradient(circle at center, ${phaseGlow} 0%, transparent 70%)` }}>
          <div className="sh-sprint__ring-container">
            <svg
              className="sh-sprint__ring-svg"
              width="220"
              height="220"
              viewBox="0 0 220 220"
            >
              <defs>
                <linearGradient id="studyGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#3b82f6" />
                  <stop offset="100%" stopColor="#6366f1" />
                </linearGradient>
                <linearGradient id="breakGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#22c55e" />
                  <stop offset="100%" stopColor="#06b6d4" />
                </linearGradient>
              </defs>
              {/* Background track */}
              <circle
                cx="110"
                cy="110"
                r={RADIUS}
                fill="none"
                stroke="var(--border)"
                strokeWidth="6"
                opacity="0.25"
              />
              {/* Progress arc */}
              <circle
                cx="110"
                cy="110"
                r={RADIUS}
                fill="none"
                stroke={ringStroke}
                strokeWidth="7"
                strokeLinecap="round"
                strokeDasharray={CIRCUMFERENCE}
                strokeDashoffset={dashOffset}
                transform="rotate(-90 110 110)"
                style={{ transition: "stroke-dashoffset 0.4s ease" }}
              />
            </svg>

            {/* Center content overlaid on SVG */}
            <div className="sh-sprint__ring-center">
              <motion.div
                className="sh-sprint__ring-time"
                animate={timeLeft <= 30 && timeLeft > 0 ? { scale: [1, 1.05, 1] } : {}}
                transition={{ duration: 0.5, repeat: timeLeft <= 30 && timeLeft > 0 ? Infinity : 0, repeatType: "loop" }}
              >
                {formatTime(timeLeft)}
              </motion.div>
              <div
                className={`sh-sprint__ring-phase${
                  isStudying
                    ? " sh-sprint__ring-phase--study"
                    : isBreak
                      ? " sh-sprint__ring-phase--break"
                      : ""
                }`}
              >
                {isStudying
                  ? "\u00C7ALI\u015EMA"
                  : isBreak
                    ? "MOLA"
                    : isFinished
                      ? "B\u0130TT\u0130"
                      : ""}
              </div>
            </div>
          </div>

          {/* Timer reached zero notification */}
          {timeLeft === 0 && (isStudying || isBreak) && (
            <motion.div
              className="sh-sprint__time-up"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
            >
              S{"\u00FC"}re doldu!
            </motion.div>
          )}
        </div>

        {/* Controls - larger buttons */}
        <div className="sh-sprint__action-bar">
          {isStudying && (
            <motion.button
              className="sh-sprint__action-btn sh-sprint__action-btn--pause"
              onClick={handlePause}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.96 }}
            >
              Duraklat
            </motion.button>
          )}
          {isBreak && (
            <motion.button
              className="sh-sprint__action-btn sh-sprint__action-btn--resume"
              onClick={handleResume}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.96 }}
            >
              Devam Et
            </motion.button>
          )}
          <motion.button
            className="sh-sprint__action-btn sh-sprint__action-btn--reset"
            onClick={handleReset}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.96 }}
          >
            S{"\u0131"}f{"\u0131"}rla
          </motion.button>
        </div>

        {/* Status update for current user */}
        <div className="sh-sprint__my-status">
          <span className="sh-sprint__my-status-label">Durumun:</span>
          <div className="sh-sprint__my-status-buttons">
            <button
              className={`sh-sprint__status-pill${
                members[userId]?.status === "studying" ? " sh-sprint__status-pill--active sh-sprint__status-pill--study" : ""
              }`}
              onClick={() => handleStatusChange("studying")}
            >
              {"\u00C7"}al{"\u0131"}{"\u015F"}{"\u0131"}yorum
            </button>
            <button
              className={`sh-sprint__status-pill${
                members[userId]?.status === "break" ? " sh-sprint__status-pill--active sh-sprint__status-pill--break" : ""
              }`}
              onClick={() => handleStatusChange("break")}
            >
              Moladay{"\u0131"}m
            </button>
            <button
              className={`sh-sprint__status-pill${
                members[userId]?.status === "idle" ? " sh-sprint__status-pill--active sh-sprint__status-pill--idle" : ""
              }`}
              onClick={() => handleStatusChange("idle")}
            >
              Beklemede
            </button>
          </div>
        </div>

        {/* Member list */}
        {memberEntries.length > 0 && (
          <div className="sh-sprint__members-section">
            <h4 className="sh-sprint__members-heading">
              {"\u00DC"}yeler
              <span className="sh-sprint__members-count">{memberEntries.length}</span>
            </h4>
            <div className="sh-sprint__members-grid">
              {memberEntries.map(([memberId, member]) => (
                <div key={memberId} className="sh-sprint__member-card">
                  <div className="sh-sprint__member-avatar" style={{ borderColor: statusColor(member.status) }}>
                    {getInitials(member.nickname)}
                    <span
                      className="sh-sprint__member-dot"
                      style={{ background: statusColor(member.status) }}
                    />
                  </div>
                  <span className="sh-sprint__member-name">
                    {member.nickname}
                    {memberId === userId ? " (sen)" : ""}
                  </span>
                  <span className="sh-sprint__member-badge" style={{ color: statusColor(member.status) }}>
                    {statusLabel(member.status)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
