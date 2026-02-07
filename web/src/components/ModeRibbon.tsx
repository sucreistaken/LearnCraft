import React, { useRef, useState, useEffect, useCallback } from "react";
import { ModeId } from "../types";

interface TabGroup {
  label: string;
  tabs: { id: ModeId; label: string }[];
}

const GROUPS: TabGroup[] = [
  {
    label: "Course",
    tabs: [
      { id: "course-dashboard", label: "Dashboard" },
    ],
  },
  {
    label: "Analysis",
    tabs: [
      { id: "plan", label: "Plan" },
      { id: "alignment", label: "Alignment" },
      { id: "deviation", label: "Deviation" },
    ],
  },
  {
    label: "Study",
    tabs: [
      { id: "lecturer-note", label: "Notes" },
      { id: "deep-dive", label: "Deep Dive" },
      { id: "lo-study", label: "LO Study" },
      { id: "mindmap", label: "Mind Map" },
    ],
  },
  {
    label: "Practice",
    tabs: [
      { id: "quiz", label: "Quiz" },
      { id: "flashcards", label: "Flashcards" },
      { id: "exam-sprint", label: "Sprint" },
      { id: "weakness", label: "Weakness" },
    ],
  },
  {
    label: "Resources",
    tabs: [
      { id: "cheat-sheet", label: "Cheat Sheet" },
      { id: "notes", label: "My Notes" },
      { id: "connections", label: "Connections" },
    ],
  },
  {
    label: "Manage",
    tabs: [
      { id: "history", label: "Lessons" },
      { id: "study-room", label: "Room" },
    ],
  },
];

export default function ModeRibbon({
  mode,
  setMode,
}: {
  mode: ModeId;
  setMode: (m: ModeId) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const threshold = 4;
    setCanScrollLeft(el.scrollLeft > threshold);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - threshold);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    checkScroll();
    el.addEventListener("scroll", checkScroll, { passive: true });
    window.addEventListener("resize", checkScroll);
    return () => {
      el.removeEventListener("scroll", checkScroll);
      window.removeEventListener("resize", checkScroll);
    };
  }, [checkScroll]);

  const scroll = (dir: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir === "left" ? -160 : 160, behavior: "smooth" });
  };

  // Scroll active tab into view on mode change
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const activeTab = el.querySelector<HTMLElement>(".tab--active");
    if (activeTab) {
      const elRect = el.getBoundingClientRect();
      const tabRect = activeTab.getBoundingClientRect();
      if (tabRect.left < elRect.left + 32 || tabRect.right > elRect.right - 32) {
        activeTab.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
      }
    }
  }, [mode]);

  return (
    <div className="mode-ribbon" role="tablist" aria-label="Content panels">
      <div className="mode-ribbon__scroll-wrap">
        {/* Scroll shadows */}
        <div className={`mode-ribbon__shadow-left${canScrollLeft ? " mode-ribbon__shadow-left--visible" : ""}`} />
        <div className={`mode-ribbon__shadow-right${canScrollRight ? " mode-ribbon__shadow-right--visible" : ""}`} />

        {/* Scroll arrows */}
        <button
          className={`mode-ribbon__arrow mode-ribbon__arrow--left${canScrollLeft ? " mode-ribbon__arrow--visible" : ""}`}
          onClick={() => scroll("left")}
          aria-label="Scroll tabs left"
          tabIndex={-1}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M10 3l-5 5 5 5"/></svg>
        </button>
        <button
          className={`mode-ribbon__arrow mode-ribbon__arrow--right${canScrollRight ? " mode-ribbon__arrow--visible" : ""}`}
          onClick={() => scroll("right")}
          aria-label="Scroll tabs right"
          tabIndex={-1}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M6 3l5 5-5 5"/></svg>
        </button>

        {/* Tabs */}
        <div className="tabs" ref={scrollRef}>
          {GROUPS.map((group, gi) => (
            <React.Fragment key={group.label}>
              {gi > 0 && <div className="tab-divider" aria-hidden="true" />}
              <div className="tab-group">
                <span className="tab-group__label">{group.label}</span>
                <div className="tab-group__tabs">
                  {group.tabs.map((t) => (
                    <button
                      key={t.id}
                      role="tab"
                      aria-selected={mode === t.id}
                      onClick={() => setMode(t.id)}
                      className={`tab ${mode === t.id ? "tab--active" : ""}`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}
