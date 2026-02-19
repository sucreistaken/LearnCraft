import React, { useState } from "react";
import type { StudyServer } from "../../types";
import { useRoomStore2 } from "../../stores/roomStore2";
import { useAuthStore } from "../../stores/authStore";
import { roomsApi } from "../../services/roomsApi";

interface Props {
  room: StudyServer;
  onClose: () => void;
}

export default function RoomSettings({ room, onClose }: Props) {
  const user = useAuthStore((s) => s.user);
  const leaveRoom = useRoomStore2((s) => s.leaveRoom);
  const deleteRoom = useRoomStore2((s) => s.deleteRoom);
  const archiveRoom = useRoomStore2((s) => s.archiveRoom);
  const [inviteCode, setInviteCode] = useState(room.inviteCode);
  const [copied, setCopied] = useState(false);
  const isOwner = user?.id === room.ownerId;

  const copyInvite = () => {
    navigator.clipboard.writeText(inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRegenerate = async () => {
    if (!user) return;
    const res = await roomsApi.regenerateInvite(room.id, user.id);
    setInviteCode(res.inviteCode);
  };

  return (
    <div className="sh-room-settings-overlay" onClick={onClose}>
      <div className="sh-room-settings" onClick={(e) => e.stopPropagation()}>
        <h3>Room Settings</h3>
        <button className="sh-room-settings__close" onClick={onClose}>&times;</button>

        <div className="sh-room-settings__section">
          <label>Invite Code</label>
          <div className="sh-room-settings__invite">
            <code>{inviteCode}</code>
            <button onClick={copyInvite}>{copied ? "Copied!" : "Copy"}</button>
            {isOwner && <button onClick={handleRegenerate}>Regenerate</button>}
          </div>
        </div>

        <div className="sh-room-settings__section">
          <label>Members ({room.memberIds?.length || 0})</label>
          <p style={{ color: "var(--muted)", fontSize: "var(--text-sm)" }}>
            {room.settings?.isPublic ? "Public room" : "Private room"} &middot; Max {room.settings?.maxMembers || 50}
          </p>
        </div>

        <div className="sh-room-settings__actions">
          <button
            className="sh-room-settings__btn sh-room-settings__btn--danger"
            onClick={() => { if (user) leaveRoom(room.id, user.id); onClose(); }}
          >
            Leave Room
          </button>
          {isOwner && (
            <>
              <button
                className="sh-room-settings__btn sh-room-settings__btn--danger"
                onClick={() => { if (user) archiveRoom(room.id, user.id); onClose(); }}
              >
                Archive Room
              </button>
              <button
                className="sh-room-settings__btn sh-room-settings__btn--danger"
                onClick={() => { if (user && confirm("Delete this room permanently?")) { deleteRoom(room.id, user.id); onClose(); } }}
              >
                Delete Room
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
