import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useServerStore } from "../../../stores/serverStore";
import { useProfileStore } from "../../../stores/profileStore";
import type { ChannelType, ToolChannelType } from "../../../types";

interface Props {
  open: boolean;
  categoryId: string | null;
  onClose: () => void;
}

const TOOL_TYPES: { value: ToolChannelType; label: string }[] = [
  { value: "deep-dive", label: "Deep Dive (AI Sohbet)" },
  { value: "flashcards", label: "Flashcards" },
  { value: "mind-map", label: "Zihin Haritası" },
  { value: "notes", label: "Notlar" },
  { value: "quiz", label: "Quiz" },
  { value: "sprint", label: "Sprint (Pomodoro)" },
];

export default function CreateChannelModal({ open, categoryId, onClose }: Props) {
  const [name, setName] = useState("");
  const [type, setType] = useState<ChannelType>("text");
  const [toolType, setToolType] = useState<ToolChannelType>("deep-dive");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const createChannel = useServerStore((s) => s.createChannel);
  const activeServerId = useServerStore((s) => s.activeServerId);
  const profile = useProfileStore((s) => s.profile);

  const handleCreate = async () => {
    if (!name.trim() || !activeServerId || !profile || !categoryId) return;
    setLoading(true);
    setError("");
    try {
      await createChannel(activeServerId, {
        userId: profile.id,
        categoryId,
        name: name.trim(),
        type,
        ...(type === "study-tool" && { toolType }),
      });
      setName("");
      setType("text");
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="modal"
            initial={{ scale: 0.85, y: 20, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.85, y: 20, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 22 }}
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 400 }}
          >
            <h3 className="modal-title">Araç Ekle</h3>

            <div className="mb-3">
              <label className="sh-label">Araç Adı</label>
              <input
                className="input w-full"
                placeholder="Ör: quiz-çalışması"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={32}
                autoFocus
              />
            </div>

            <div className="mb-3">
              <label className="sh-label">Tür</label>
              <select
                className="lc-select w-full"
                value={type}
                onChange={(e) => setType(e.target.value as ChannelType)}
              >
                <option value="text">Sohbet</option>
                <option value="study-tool">Çalışma Aracı</option>
                <option value="announcement">Duyuru</option>
              </select>
            </div>

            {type === "study-tool" && (
              <div className="mb-3">
                <label className="sh-label">Araç Türü</label>
                <select
                  className="lc-select w-full"
                  value={toolType}
                  onChange={(e) => setToolType(e.target.value as ToolChannelType)}
                >
                  {TOOL_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
            )}

            {error && <p style={{ color: "var(--danger)", marginBottom: 12 }}>{error}</p>}

            <div className="sh-modal-actions">
              <button className="btn btn--ghost" onClick={onClose}>İptal</button>
              <button
                className="btn btn--primary"
                onClick={handleCreate}
                disabled={!name.trim() || loading}
              >
                {loading ? "Oluşturuluyor..." : "Oluştur"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
