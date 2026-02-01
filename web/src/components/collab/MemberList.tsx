import React from "react";
import { useRoomStore } from "../../stores/roomStore";

const toolIcons: Record<string, string> = {
  "deep-dive": "\uD83D\uDCAC",
  flashcards: "\uD83C\uDCCF",
  "mind-map": "\uD83D\uDDFA\uFE0F",
  notes: "\uD83D\uDCDD",
};

export default function MemberList() {
  const participants = useRoomStore((s) => s.participants);
  const members = useRoomStore((s) => s.members);
  const identity = useRoomStore((s) => s.identity);

  const onlineIds = new Set(participants.map((p) => p.id));
  const offlineMembers = members.filter((m) => !onlineIds.has(m.userId));

  return (
    <div className="ws-members">
      <div className="ws-members__title">
        Members ({participants.length} online)
      </div>

      {participants.map((p) => {
        const isSelf = p.id === identity?.id;
        return (
          <div key={p.id} className="ws-member">
            <div
              className={`ws-member__avatar${isSelf ? " ws-member__avatar--self" : ""}`}
              style={{ background: p.avatar }}
            >
              {p.nickname.charAt(0).toUpperCase()}
              <span className="ws-member__dot" />
            </div>
            <span className="ws-member__name">
              {p.nickname}
              {isSelf && <span className="ws-member__you"> (you)</span>}
            </span>
            {(p as any).activeTool && (
              <span className="ws-member__tool">
                {toolIcons[(p as any).activeTool] || ""}
              </span>
            )}
          </div>
        );
      })}

      {offlineMembers.length > 0 && (
        <>
          <div className="ws-members__title" style={{ marginTop: 6 }}>Offline</div>
          {offlineMembers.map((m) => (
            <div key={m.userId} className="ws-member ws-member--offline">
              <div className="ws-member__avatar" style={{ background: m.avatar }}>
                {m.nickname.charAt(0).toUpperCase()}
              </div>
              <span className="ws-member__name">{m.nickname}</span>
              {m.contributionCount > 0 && (
                <span className="ws-member__tool">{m.contributionCount}</span>
              )}
            </div>
          ))}
        </>
      )}
    </div>
  );
}
