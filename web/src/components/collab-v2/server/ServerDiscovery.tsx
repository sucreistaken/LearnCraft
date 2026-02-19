import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { serversApi } from "../../../services/collabApi";
import { useServerStore } from "../../../stores/serverStore";
import { useProfileStore } from "../../../stores/profileStore";
import type { StudyServer } from "../../../types";
import LobbyChat from "../chat/LobbyChat";

interface Props {
  onCreateServer?: () => void;
}

export default function ServerDiscovery({ onCreateServer }: Props) {
  const [search, setSearch] = useState("");
  const [servers, setServers] = useState<StudyServer[]>([]);
  const [loading, setLoading] = useState(false);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [activeTab, setActiveTab] = useState<"discover" | "chat">("discover");

  const profile = useProfileStore((s) => s.profile);
  const userServers = useServerStore((s) => s.servers);
  const joinPublicServer = useServerStore((s) => s.joinPublicServer);
  const selectServer = useServerStore((s) => s.selectServer);

  const fetchServers = useCallback(async (query?: string) => {
    setLoading(true);
    try {
      const results = await serversApi.discover(query || undefined);
      setServers(results);
      setHasSearched(true);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchServers();
  }, []);

  const handleSearch = () => {
    fetchServers(search.trim());
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  const handleJoin = async (server: StudyServer) => {
    if (!profile) return;
    setJoiningId(server.id);
    try {
      await joinPublicServer(server.id, profile.id);
      await selectServer(server.id);
      toast.success(`${server.name} çalışma odasına katıldınız!`);
    } catch (err: any) {
      toast.error(err?.message || "Katılınamadı");
    } finally {
      setJoiningId(null);
    }
  };

  const isAlreadyMember = (serverId: string) => {
    return userServers.some((s) => s.id === serverId);
  };

  const hasNoServers = userServers.length === 0;

  return (
    <div className="sh-main-content">
      <div className="sh-discovery">
        {/* Welcome header */}
        <motion.div
          className="sh-discovery__header"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="sh-discovery__welcome-icon">📚</div>
          <h2 className="sh-discovery__title">
            {hasNoServers ? "Çalışma Platformuna Hoş Geldin!" : "Ana Sayfa"}
          </h2>
          <p className="sh-discovery__subtitle">
            {hasNoServers
              ? "Birlikte çalışmaya başlamak için bir çalışma odası oluştur veya mevcut bir odaya katıl"
              : "Yeni çalışma odaları keşfet veya mevcut odalarına dön"}
          </p>
        </motion.div>

        {/* Quick action cards - shown prominently when user has no servers */}
        {hasNoServers && (
          <motion.div
            className="sh-discovery__actions"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.15 }}
          >
            <div className="sh-action-card sh-action-card--primary" onClick={onCreateServer}>
              <div className="sh-action-card__icon">✨</div>
              <div className="sh-action-card__content">
                <h3 className="sh-action-card__title">Oda Oluştur</h3>
                <p className="sh-action-card__desc">Hazır şablonlarla hızlıca çalışma odası kur</p>
              </div>
              <span className="sh-action-card__arrow">→</span>
            </div>

            <div className="sh-onboarding-hint">
              <div className="sh-onboarding-hint__icon">💡</div>
              <div className="sh-onboarding-hint__text">
                <strong>Nasıl çalışır?</strong> Oda oluştur → Arkadaşlarını davet et → Birlikte quiz çöz, flashcard çalış, sprint yap!
              </div>
            </div>
          </motion.div>
        )}

        {/* Quick actions bar - shown when user has servers */}
        {!hasNoServers && (
          <motion.div
            className="sh-discovery__quick-bar"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.1 }}
          >
            <button className="sh-quick-btn" onClick={onCreateServer}>
              <span className="sh-quick-btn__icon">+</span>
              <span>Oda Oluştur</span>
            </button>
          </motion.div>
        )}

        {/* Tab bar: Keşfet | Sohbet */}
        <div className="sh-discovery__tabs">
          <button
            className={`sh-discovery__tab ${activeTab === "discover" ? "sh-discovery__tab--active" : ""}`}
            onClick={() => setActiveTab("discover")}
          >
            🔍 Keşfet
          </button>
          <button
            className={`sh-discovery__tab ${activeTab === "chat" ? "sh-discovery__tab--active" : ""}`}
            onClick={() => setActiveTab("chat")}
          >
            💬 Sohbet
          </button>
        </div>

        {/* TAB CONTENT */}
        {activeTab === "discover" && (
          <>
            {/* Search section */}
            <motion.div
              className="sh-discovery__search-section"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3, delay: 0.2 }}
            >
              <h3 className="sh-discovery__section-title">
                Herkese Açık Çalışma Odalarını Keşfet
              </h3>
              <div className="sh-discovery__search">
                <div className="sh-discovery__search-icon">🔍</div>
                <input
                  className="sh-discovery__input"
                  placeholder="Çalışma odası, ders veya üniversite ara..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={handleKeyDown}
                />
                <button
                  className="btn btn--primary sh-discovery__search-btn"
                  onClick={handleSearch}
                  disabled={loading}
                >
                  {loading ? "..." : "Ara"}
                </button>
              </div>
            </motion.div>

            {/* Results */}
            <div className="sh-discovery__results">
              <AnimatePresence mode="wait">
                {loading && servers.length === 0 && (
                  <motion.div
                    key="loading"
                    className="sh-discovery__loading"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <div className="sh-skeleton sh-skeleton--card" />
                    <div className="sh-skeleton sh-skeleton--card" />
                    <div className="sh-skeleton sh-skeleton--card" />
                  </motion.div>
                )}

                {!loading && hasSearched && servers.length === 0 && (
                  <motion.div
                    key="empty"
                    className="sh-discovery__empty"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <div className="sh-discovery__empty-icon">
                      {search ? "🔎" : "🌱"}
                    </div>
                    <p className="sh-discovery__empty-title">
                      {search ? "Sonuç bulunamadı" : "Henüz herkese açık çalışma odası yok"}
                    </p>
                    <p className="sh-discovery__empty-desc">
                      {search
                        ? "Farklı anahtar kelimeler deneyin"
                        : "İlk herkese açık odayı siz oluşturun!"}
                    </p>
                    {!search && (
                      <button className="btn btn--primary" onClick={onCreateServer} style={{ marginTop: 16 }}>
                        Oda Oluştur
                      </button>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {servers.map((server, index) => {
                const isMember = isAlreadyMember(server.id);
                return (
                  <motion.div
                    key={server.id}
                    className="sh-server-card"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: index * 0.05 }}
                  >
                    <div
                      className="sh-server-card__icon"
                      style={{ background: server.iconColor }}
                    >
                      {server.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="sh-server-card__info">
                      <div className="sh-server-card__name-row">
                        <h3 className="sh-server-card__name">{server.name}</h3>
                        {server.university && (
                          <span className="sh-server-card__university">{server.university}</span>
                        )}
                      </div>
                      {server.description && (
                        <p className="sh-server-card__desc">{server.description}</p>
                      )}
                      <div className="sh-server-card__meta">
                        <span className="sh-server-card__members">
                          {server.memberCount || server.memberIds.length} kişi
                        </span>
                        {server.tags && server.tags.length > 0 && (
                          <div className="sh-server-card__tags">
                            {server.tags.slice(0, 5).map((tag) => (
                              <span key={tag} className="sh-server-card__tag">{tag}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="sh-server-card__action">
                      {isMember ? (
                        <button
                          className="btn btn--ghost sh-server-card__btn"
                          onClick={() => selectServer(server.id)}
                        >
                          Git →
                        </button>
                      ) : (
                        <button
                          className="btn btn--primary sh-server-card__btn"
                          onClick={() => handleJoin(server)}
                          disabled={joiningId === server.id}
                        >
                          {joiningId === server.id ? "..." : "Katıl"}
                        </button>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </>
        )}

        {activeTab === "chat" && (
          <div className="sh-discovery__lobby">
            <LobbyChat />
          </div>
        )}
      </div>
    </div>
  );
}
