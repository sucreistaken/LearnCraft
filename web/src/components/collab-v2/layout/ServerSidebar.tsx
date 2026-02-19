import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useServerStore } from "../../../stores/serverStore";
import { useProfileStore } from "../../../stores/profileStore";

interface Props {
  onCreateServer: () => void;
  onNavigate?: (panel: number) => void;
}

export default function ServerSidebar({ onCreateServer, onNavigate }: Props) {
  const servers = useServerStore((s) => s.servers);
  const activeServerId = useServerStore((s) => s.activeServerId);
  const selectServer = useServerStore((s) => s.selectServer);
  const deselectServer = useServerStore((s) => s.deselectServer);
  const profile = useProfileStore((s) => s.profile);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const handleServerClick = (serverId: string) => {
    selectServer(serverId);
    onNavigate?.(1); // Go to channel panel on mobile
  };

  const handleHomeClick = () => {
    deselectServer();
    onNavigate?.(2); // Go to main content (discovery) on mobile
  };

  return (
    <div className="sh-server-sidebar">
      {/* Home button */}
      <motion.div
        className={`sh-server-icon ${!activeServerId ? "sh-server-icon--active" : ""}`}
        style={{ background: "var(--accent-2)" }}
        title="Ana Sayfa"
        onClick={handleHomeClick}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.92 }}
        transition={{ type: "spring", stiffness: 400, damping: 17 }}
      >
        <span style={{ fontSize: "18px", fontWeight: 700 }}>LC</span>
      </motion.div>

      <div className="sh-server-divider" />

      {/* Server list */}
      {servers.map((server) => {
        const isActive = server.id === activeServerId;
        const isHovered = server.id === hoveredId;
        return (
          <motion.div
            key={server.id}
            className={`sh-server-icon ${isActive ? "sh-server-icon--active" : ""}`}
            style={{ background: server.iconColor }}
            title={server.name}
            onClick={() => handleServerClick(server.id)}
            onMouseEnter={() => setHoveredId(server.id)}
            onMouseLeave={() => setHoveredId(null)}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.92 }}
            transition={{ type: "spring", stiffness: 400, damping: 17 }}
          >
            {/* Pill indicator */}
            <AnimatePresence>
              {(isActive || isHovered) && (
                <motion.div
                  layoutId="server-pill"
                  className="sh-server-pill"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                />
              )}
            </AnimatePresence>
            <span className="sh-server-icon__letter">
              {server.name.charAt(0).toUpperCase()}
            </span>
          </motion.div>
        );
      })}

      {/* Add server button */}
      <motion.div
        className="sh-server-icon sh-server-icon--add"
        title="Oda Oluştur"
        onClick={onCreateServer}
        whileHover={{ scale: 1.1, rotate: 90 }}
        whileTap={{ scale: 0.9 }}
        transition={{ type: "spring", stiffness: 300, damping: 15 }}
      >
        <span style={{ fontSize: "22px", lineHeight: 1 }}>+</span>
      </motion.div>

      {/* User avatar at bottom */}
      {profile && (
        <div
          className="sh-server-icon sh-server-icon--user"
          style={{ background: profile.avatar, marginTop: "auto" }}
          title={`${profile.nickname} (${profile.friendCode})`}
        >
          <span className="sh-server-icon__letter">
            {profile.nickname.charAt(0).toUpperCase()}
          </span>
        </div>
      )}
    </div>
  );
}
