import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRoomStore } from "../../stores/roomStore";

export default function JoinRoomModal() {
  const show = useRoomStore((s) => s.showJoinModal);
  const setShow = useRoomStore((s) => s.setShowJoinModal);
  const joinRoomByCode = useRoomStore((s) => s.joinRoomByCode);
  const connecting = useRoomStore((s) => s.connecting);
  const error = useRoomStore((s) => s.error);

  const [code, setCode] = useState("");

  if (!show) return null;

  const handleJoin = () => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;
    joinRoomByCode(trimmed);
  };

  return (
    <AnimatePresence>
      <motion.div
        className="modal-backdrop"
        onClick={() => setShow(false)}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          className="modal"
          onClick={(e) => e.stopPropagation()}
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          style={{ maxWidth: 380 }}
        >
          <div className="modal-title h3 mb-2">Join Study Room</div>
          <p className="muted small mb-4">
            Enter the 6-character room code shared by your friend.
          </p>

          <input
            autoFocus
            className="lc-textarea input mb-4 w-full"
            placeholder="e.g. MATH42"
            value={code}
            maxLength={6}
            style={{
              textAlign: "center",
              fontSize: 24,
              fontWeight: 700,
              letterSpacing: 6,
              textTransform: "uppercase",
            }}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleJoin();
              if (e.key === "Escape") setShow(false);
            }}
          />

          {error && <div className="error text-red-500 text-sm mb-3">{error}</div>}

          <div className="modal-actions flex justify-end gap-2">
            <button className="btn btn-secondary" onClick={() => setShow(false)}>
              Cancel
            </button>
            <motion.button
              className="btn btn-primary"
              onClick={handleJoin}
              disabled={code.trim().length < 4 || connecting}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {connecting ? "Joining..." : "Join Room"}
            </motion.button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
