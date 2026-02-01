import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRoomStore } from "../../stores/roomStore";

export default function NicknamePrompt() {
  const identity = useRoomStore((s) => s.identity);
  const setNickname = useRoomStore((s) => s.setNickname);
  const [name, setName] = useState("");

  if (identity) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="modal-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{ zIndex: 9999 }}
      >
        <motion.div
          className="modal"
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          style={{ maxWidth: 380 }}
        >
          <div className="modal-title h3 mb-2">Welcome to LearnCraft</div>
          <p className="muted small mb-4">
            Choose a nickname to use in Study Rooms and collaborative sessions.
          </p>

          <input
            autoFocus
            className="lc-textarea input mb-4 w-full"
            placeholder="Your nickname..."
            value={name}
            maxLength={20}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && name.trim()) setNickname(name.trim());
            }}
          />

          <div className="modal-actions flex justify-end">
            <motion.button
              className="btn btn-primary"
              onClick={() => name.trim() && setNickname(name.trim())}
              disabled={!name.trim()}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              Continue
            </motion.button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
