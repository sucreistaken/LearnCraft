import React from "react";
import { useRoomStore } from "../../stores/roomStore";

export default function IdentityBadge() {
  const identity = useRoomStore((s) => s.identity);

  if (!identity) return null;

  return (
    <div
      className="identity-badge"
      title={`Logged in as ${identity.nickname}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 10px",
        borderRadius: 20,
        fontSize: 12,
        fontWeight: 600,
        background: "var(--surface-2, #f3f4f6)",
        color: "var(--text, #1f2937)",
        border: "1px solid var(--border, #e5e7eb)",
      }}
    >
      <span
        style={{
          width: 18,
          height: 18,
          borderRadius: "50%",
          background: identity.avatar,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#fff",
          fontSize: 10,
          fontWeight: 700,
          flexShrink: 0,
        }}
      >
        {identity.nickname.charAt(0).toUpperCase()}
      </span>
      {identity.nickname}
    </div>
  );
}
