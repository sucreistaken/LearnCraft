import { useState } from "react";
import { motion } from "framer-motion";
import { useServerStore } from "../../../stores/serverStore";
import type { Channel } from "../../../types";

const TOOL_ICONS: Record<string, string> = {
  "deep-dive": "🔬",
  "flashcards": "🃏",
  "mind-map": "🧠",
  "notes": "📝",
  "quiz": "❓",
  "sprint": "⏱️",
};

const TOOL_DESCRIPTIONS: Record<string, string> = {
  "deep-dive": "AI ile derinlemesine analiz",
  "flashcards": "Kartlarla tekrar et",
  "mind-map": "Konuyu görselleştir",
  "notes": "Birlikte not al",
  "quiz": "Bilgini test et",
  "sprint": "Odaklanarak çalış",
};

const CHANNEL_TYPE_ICONS: Record<string, string> = {
  text: "#",
  "study-tool": "🔧",
  announcement: "📢",
};

interface Props {
  onInvite: () => void;
  onServerSettings: () => void;
  onCreateChannel: (categoryId: string) => void;
  onNavigate?: (panel: number) => void;
}

export default function ChannelSidebar({ onInvite, onServerSettings, onCreateChannel, onNavigate }: Props) {
  const servers = useServerStore((s) => s.servers);
  const activeServerId = useServerStore((s) => s.activeServerId);
  const server = activeServerId ? servers.find((s) => s.id === activeServerId) ?? null : null;
  const channels = useServerStore((s) => s.channels);
  const activeChannelId = useServerStore((s) => s.activeChannelId);
  const selectChannel = useServerStore((s) => s.selectChannel);
  const loading = useServerStore((s) => s.loading);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  if (!server) {
    return (
      <div className="sh-channel-sidebar">
        <div className="sh-channel-sidebar__empty">
          <p>Bir çalışma odası seçin veya yeni oda oluşturun</p>
        </div>
      </div>
    );
  }

  const toggleSection = (sectionId: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  };

  const getChannelIcon = (ch: Channel) => {
    if (ch.type === "study-tool" && ch.toolType) return TOOL_ICONS[ch.toolType] || "🔧";
    return CHANNEL_TYPE_ICONS[ch.type] || "#";
  };

  // Collect all channels across all categories
  const toolChannels: Channel[] = [];
  const chatChannels: Channel[] = [];

  for (const cat of server.categories) {
    const catChannels = channels.filter((ch) => cat.channelIds.includes(ch.id));
    for (const ch of catChannels) {
      if (ch.type === "study-tool") {
        toolChannels.push(ch);
      } else {
        chatChannels.push(ch);
      }
    }
  }

  const handleChannelClick = (ch: Channel) => {
    selectChannel(ch.id);
    onNavigate?.(2); // Go to main content on mobile
  };

  // Find first category to allow adding channels
  const firstCatId = server.categories[0]?.id;

  const isToolsCollapsed = collapsedSections.has("tools");
  const isChatCollapsed = collapsedSections.has("chat");

  return (
    <div className="sh-channel-sidebar">
      {/* Server header */}
      <div className="sh-channel-sidebar__header" onClick={onServerSettings}>
        <h3 className="sh-channel-sidebar__server-name">{server.name}</h3>
        <span className="sh-channel-sidebar__chevron">▾</span>
      </div>

      {/* Channel list */}
      <div className="sh-channel-sidebar__list">
        {loading && channels.length === 0 && (
          <div className="sh-channel-sidebar__loading">
            <div className="sh-skeleton sh-skeleton--channel" />
            <div className="sh-skeleton sh-skeleton--channel" />
            <div className="sh-skeleton sh-skeleton--channel" />
          </div>
        )}

        {/* TOOLS section */}
        {toolChannels.length > 0 && (
          <div className="sh-category">
            <div className="sh-category__header" onClick={() => toggleSection("tools")}>
              <span className={`sh-category__arrow ${isToolsCollapsed ? "sh-category__arrow--collapsed" : ""}`}>
                ▾
              </span>
              <span className="sh-category__name">ARAÇLAR</span>
              {firstCatId && (
                <button
                  className="sh-category__add"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCreateChannel(firstCatId);
                  }}
                  title="Araç ekle"
                >
                  +
                </button>
              )}
            </div>
            {!isToolsCollapsed && (
              <div className="sh-channel-tools">
                {toolChannels.map((ch) => (
                  <motion.div
                    key={ch.id}
                    className={`sh-channel-tool ${activeChannelId === ch.id ? "sh-channel-tool--active" : ""}`}
                    onClick={() => handleChannelClick(ch)}
                    whileHover={{ x: -2, y: -2 }}
                    whileTap={{ x: 2, y: 2 }}
                    transition={{ type: "spring", stiffness: 400, damping: 20 }}
                  >
                    <span className="sh-channel-tool__icon">{getChannelIcon(ch)}</span>
                    <div className="sh-channel-tool__info">
                      <span className="sh-channel-tool__name">{ch.name}</span>
                      {ch.toolType && TOOL_DESCRIPTIONS[ch.toolType] && (
                        <span className="sh-channel-tool__desc">{TOOL_DESCRIPTIONS[ch.toolType]}</span>
                      )}
                    </div>
                    {ch.lessonId && <span className="sh-channel-tool__material-dot" title={ch.lessonTitle} />}
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* CHAT section */}
        {chatChannels.length > 0 && (
          <div className="sh-category">
            <div className="sh-category__header" onClick={() => toggleSection("chat")}>
              <span className={`sh-category__arrow ${isChatCollapsed ? "sh-category__arrow--collapsed" : ""}`}>
                ▾
              </span>
              <span className="sh-category__name">SOHBET</span>
            </div>
            {!isChatCollapsed &&
              chatChannels.map((ch) => (
                <div
                  key={ch.id}
                  className={`sh-channel ${activeChannelId === ch.id ? "sh-channel--active" : ""}`}
                  onClick={() => handleChannelClick(ch)}
                >
                  <span className="sh-channel__icon">{getChannelIcon(ch)}</span>
                  <span className="sh-channel__name">{ch.name}</span>
                </div>
              ))}
          </div>
        )}

        {/* If no channels at all, show hint */}
        {toolChannels.length === 0 && chatChannels.length === 0 && !loading && (
          <div className="sh-channel-sidebar__empty">
            <p>Henüz araç eklenmemiş</p>
            {firstCatId && (
              <button
                className="btn btn--primary btn--sm"
                onClick={() => onCreateChannel(firstCatId)}
                style={{ marginTop: 8 }}
              >
                Araç Ekle
              </button>
            )}
          </div>
        )}
      </div>

      {/* Bottom actions */}
      <div className="sh-channel-sidebar__footer">
        <button className="sh-channel-sidebar__invite-btn" onClick={onInvite}>
          Davet Et
        </button>
      </div>
    </div>
  );
}
