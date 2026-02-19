import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useServerStore } from "../../../stores/serverStore";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function InviteModal({ open, onClose }: Props) {
  const servers = useServerStore((s) => s.servers);
  const activeServerId = useServerStore((s) => s.activeServerId);
  const server = activeServerId ? servers.find((s) => s.id === activeServerId) ?? null : null;
  const [copied, setCopied] = useState(false);

  if (!server) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(server.inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
            <h3 className="modal-title">Arkadaşlarını Davet Et</h3>
            <p style={{ opacity: 0.7, marginBottom: 16 }}>
              Bu kodu arkadaşlarınla paylaş, çalışma odasına katılabilirler.
            </p>

            <div className="sh-invite-code-box">
              <span className="sh-invite-code">{server.inviteCode}</span>
              <button
                className="btn btn--primary btn--sm"
                onClick={handleCopy}
              >
                {copied ? "Kopyalandı!" : "Kopyala"}
              </button>
            </div>

            <div className="sh-modal-actions" style={{ marginTop: 20 }}>
              <button className="btn btn--ghost" onClick={onClose}>Kapat</button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
