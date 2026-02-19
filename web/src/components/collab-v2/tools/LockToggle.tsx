import { useState } from "react";
import { channelToolApi } from "../../../services/channelToolApi";
import { getCollabSocket } from "../../../services/collabSocket";

interface Props {
  channelId: string;
  userId: string;
  locked: boolean;
  lockedBy: string | null;
  isOwner: boolean;
  onLockChange: (locked: boolean, lockedBy: string | null) => void;
}

export default function LockToggle({ channelId, userId, locked, lockedBy, isOwner, onLockChange }: Props) {
  const [toggling, setToggling] = useState(false);

  async function handleToggle() {
    if (toggling || !isOwner) return;
    setToggling(true);
    try {
      if (locked) {
        const res = await channelToolApi.unlockTool(channelId);
        onLockChange(res.locked, res.lockedBy);
        getCollabSocket().emit("tool:unlock", { channelId });
      } else {
        const res = await channelToolApi.lockTool(channelId, userId);
        onLockChange(res.locked, res.lockedBy);
        getCollabSocket().emit("tool:lock", { channelId, lockedBy: userId });
      }
    } catch (err) {
      console.error("Lock toggle failed:", err);
    } finally {
      setToggling(false);
    }
  }

  if (!isOwner && !locked) return null;

  return (
    <button
      className={`sh-lock-toggle${locked ? " sh-lock-toggle--locked" : ""}`}
      onClick={handleToggle}
      disabled={toggling || !isOwner}
      title={locked ? "Kilidi a\u00E7 (sadece sahip)" : "Kilitle (sadece g\u00F6r\u00FCnt\u00FCleme)"}
    >
      {locked ? "\uD83D\uDD12" : "\uD83D\uDD13"}
    </button>
  );
}
