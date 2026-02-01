import React, { useState, useRef, useEffect } from "react";
import { useShareStore } from "../../stores/shareStore";
import { useLessonStore } from "../../stores/lessonStore";
import { useRoomStore } from "../../stores/roomStore";
import { useUiStore } from "../../stores/uiStore";

export default function ShareButton() {
  const [copied, setCopied] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const { createShare, loading } = useShareStore();
  const currentLessonId = useLessonStore((s) => s.currentLessonId);
  const currentRoom = useRoomStore((s) => s.currentRoom);
  const setMode = useUiStore((s) => s.setMode);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    if (!showMenu) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showMenu]);

  const handleShareLink = async () => {
    if (!currentLessonId) return;
    const shareId = await createShare(currentLessonId);
    if (shareId) {
      const url = `${window.location.origin}?share=${shareId}`;
      try {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        window.prompt("Share link:", url);
      }
    }
    setShowMenu(false);
  };

  const handleShareToRoom = () => {
    setMode("study-room");
    setShowMenu(false);
  };

  if (!currentLessonId) return null;

  return (
    <div ref={menuRef} style={{ position: "relative" }}>
      <button
        className="share-btn"
        onClick={() => setShowMenu(!showMenu)}
        disabled={loading}
      >
        <span className="share-btn__icon" aria-hidden="true">
          {copied ? "\u2713" : "\u21D7"}
        </span>
        {loading ? "Creating..." : copied ? "Copied!" : "Share"}
      </button>

      {showMenu && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            right: 0,
            background: "var(--surface, #fff)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
            minWidth: 180,
            zIndex: 100,
            overflow: "hidden",
          }}
        >
          <button
            onClick={handleShareLink}
            style={{
              display: "block",
              width: "100%",
              padding: "10px 14px",
              border: "none",
              background: "none",
              textAlign: "left",
              cursor: "pointer",
              fontSize: 13,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-2, #f3f4f6)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
          >
            Share Link
          </button>
          <button
            onClick={handleShareToRoom}
            style={{
              display: "block",
              width: "100%",
              padding: "10px 14px",
              border: "none",
              background: "none",
              textAlign: "left",
              cursor: "pointer",
              fontSize: 13,
              borderTop: "1px solid var(--border)",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-2, #f3f4f6)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
          >
            Share to Room
            {currentRoom && (
              <span style={{ fontSize: 10, opacity: 0.6, marginLeft: 4 }}>
                ({currentRoom.code})
              </span>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
