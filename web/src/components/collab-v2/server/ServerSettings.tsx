import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useServerStore } from "../../../stores/serverStore";
import { useProfileStore } from "../../../stores/profileStore";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function ServerSettings({ open, onClose }: Props) {
  const servers = useServerStore((s) => s.servers);
  const activeServerId = useServerStore((s) => s.activeServerId);
  const server = activeServerId ? servers.find((s) => s.id === activeServerId) ?? null : null;
  const profile = useProfileStore((s) => s.profile);
  const leaveServer = useServerStore((s) => s.leaveServer);
  const deleteServer = useServerStore((s) => s.deleteServer);

  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!server || !profile) return null;

  const isOwner = server.ownerId === profile.id;

  const handleLeave = async () => {
    await leaveServer(server.id, profile.id);
    onClose();
  };

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    await deleteServer(server.id, profile.id);
    onClose();
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
            style={{ maxWidth: 440 }}
          >
            <h3 className="modal-title">{server.name}</h3>

            <div className="sh-settings-section">
              <h4 className="sh-settings-label">Bilgiler</h4>
              <p className="sh-settings-info">
                <strong>Üye Sayısı:</strong> {server.memberIds.length}
              </p>
              <p className="sh-settings-info">
                <strong>Davet Kodu:</strong> {server.inviteCode}
              </p>
              <p className="sh-settings-info">
                <strong>Oluşturulma:</strong> {new Date(server.createdAt).toLocaleDateString("tr-TR")}
              </p>
              {server.description && (
                <p className="sh-settings-info">
                  <strong>Açıklama:</strong> {server.description}
                </p>
              )}
              <p className="sh-settings-info">
                <strong>Durum:</strong> {server.settings.isPublic ? "Herkese Açık" : "Özel (Davet ile)"}
              </p>
              {server.university && (
                <p className="sh-settings-info">
                  <strong>Üniversite:</strong> {server.university}
                </p>
              )}
              {server.tags && server.tags.length > 0 && (
                <p className="sh-settings-info">
                  <strong>Etiketler:</strong> {server.tags.join(", ")}
                </p>
              )}
            </div>

            <div className="sh-settings-section">
              <h4 className="sh-settings-label">Kategoriler</h4>
              {server.categories.map((cat) => (
                <p key={cat.id} className="sh-settings-info">
                  {cat.name} ({cat.channelIds.length} araç)
                </p>
              ))}
            </div>

            <div className="sh-modal-actions">
              <button className="btn btn--ghost" onClick={onClose}>Kapat</button>

              {!isOwner && (
                <button
                  className="btn btn--danger"
                  onClick={handleLeave}
                >
                  Odadan Ayrıl
                </button>
              )}

              {isOwner && (
                <button
                  className="btn btn--danger"
                  onClick={handleDelete}
                >
                  {confirmDelete ? "Emin misiniz? Tekrar tıklayın" : "Odayı Sil"}
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
