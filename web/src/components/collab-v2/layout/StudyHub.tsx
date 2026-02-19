import { useEffect, useState } from "react";
import { useProfileStore } from "../../../stores/profileStore";
import { useServerStore } from "../../../stores/serverStore";
import { useMessageStore } from "../../../stores/messageStore";
import { useChannelToolStore } from "../../../stores/channelToolStore";
import { getCollabSocket } from "../../../services/collabSocket";
import { useMediaQuery } from "../../../hooks/useMediaQuery";
import ProfileSetup from "../ProfileSetup";
import ServerSidebar from "./ServerSidebar";
import ChannelSidebar from "./ChannelSidebar";
import MainContent from "./MainContent";
import MemberSidebar from "./MemberSidebar";
import MiniChat from "../chat/MiniChat";
import SwipeContainer from "./SwipeContainer";
import CreateServerModal from "../server/CreateServerModal";
import InviteModal from "../server/InviteModal";
import ServerSettings from "../server/ServerSettings";
import CreateChannelModal from "../server/CreateChannelModal";

export default function StudyHub() {
  const profile = useProfileStore((s) => s.profile);
  const connectSocket = useProfileStore((s) => s.connectSocket);
  const loadServers = useServerStore((s) => s.loadServers);
  const setupServerListeners = useServerStore((s) => s.setupListeners);
  const setupMessageListeners = useMessageStore((s) => s.setupListeners);
  const setupToolListeners = useChannelToolStore((s) => s.setupListeners);

  const activeServerId = useServerStore((s) => s.activeServerId);
  const activeChannelId = useServerStore((s) => s.activeChannelId);
  const activeChatChannelId = useServerStore((s) => s.activeChatChannelId);
  const channels = useServerStore((s) => s.channels);
  const activeChannel = activeChannelId ? channels.find((c) => c.id === activeChannelId) ?? null : null;
  const chatChannel = activeChatChannelId ? channels.find((c) => c.id === activeChatChannelId) ?? null : null;

  const [showCreateServer, setShowCreateServer] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [createChannelCatId, setCreateChannelCatId] = useState<string | null>(null);
  const [disconnected, setDisconnected] = useState(false);

  // Mobile responsive
  const isMobile = useMediaQuery("(max-width: 768px)");
  const [activePanel, setActivePanel] = useState<number>(2); // 0=servers, 1=channels, 2=main

  // Show MiniChat only when a study-tool channel is active (text channels get FullChat in main)
  const showMiniChat =
    activeServerId &&
    chatChannel &&
    activeChannel?.type === "study-tool";

  // Initialize socket and load data
  useEffect(() => {
    if (!profile) return;

    connectSocket().then(() => {
      loadServers(profile.id);
      setupServerListeners();
      setupMessageListeners();
      setupToolListeners();
    });

    const socket = getCollabSocket();

    const onDisconnect = () => setDisconnected(true);
    const onConnect = () => {
      setDisconnected(false);
      setupServerListeners();
      setupMessageListeners();
      setupToolListeners();
    };

    socket.on("disconnect", onDisconnect);
    socket.on("connect", onConnect);

    return () => {
      socket.off("disconnect", onDisconnect);
      socket.off("connect", onConnect);
    };
  }, [profile?.id]);

  // Show profile setup if no profile
  if (!profile) {
    return <ProfileSetup />;
  }

  const handleNavigate = (panel: number) => setActivePanel(panel);

  const sidebarContent = (
    <ServerSidebar
      onCreateServer={() => setShowCreateServer(true)}
      onNavigate={isMobile ? handleNavigate : undefined}
    />
  );

  const channelContent = (
    <ChannelSidebar
      onInvite={() => setShowInvite(true)}
      onServerSettings={() => setShowSettings(true)}
      onCreateChannel={(catId) => setCreateChannelCatId(catId)}
      onNavigate={isMobile ? handleNavigate : undefined}
    />
  );

  const mainContent = (
    <MainContent
      onCreateServer={() => setShowCreateServer(true)}
      onNavigate={isMobile ? handleNavigate : undefined}
      isMobile={isMobile}
    />
  );

  const modals = (
    <>
      <CreateServerModal
        open={showCreateServer}
        onClose={() => setShowCreateServer(false)}
      />
      <InviteModal
        open={showInvite}
        onClose={() => setShowInvite(false)}
      />
      <ServerSettings
        open={showSettings}
        onClose={() => setShowSettings(false)}
      />
      <CreateChannelModal
        open={!!createChannelCatId}
        categoryId={createChannelCatId}
        onClose={() => setCreateChannelCatId(null)}
      />
    </>
  );

  // MOBILE: SwipeContainer with 3 panels
  if (isMobile) {
    return (
      <div className="sh-container sh-container--mobile">
        {disconnected && (
          <div className="sh-reconnect-banner">
            Bağlantı koptu, yeniden bağlanılıyor...
          </div>
        )}
        <SwipeContainer activePanel={activePanel} onPanelChange={setActivePanel}>
          {[sidebarContent, channelContent, mainContent]}
        </SwipeContainer>

        {showMiniChat && (
          <MiniChat
            channelId={chatChannel!.id}
            serverId={activeServerId!}
            channelName={chatChannel!.name}
          />
        )}

        {modals}
      </div>
    );
  }

  // DESKTOP: Standard flex layout
  return (
    <div className="sh-container">
      {disconnected && (
        <div className="sh-reconnect-banner">
          Bağlantı koptu, yeniden bağlanılıyor...
        </div>
      )}
      {sidebarContent}
      {channelContent}
      {mainContent}
      <MemberSidebar />

      {showMiniChat && (
        <MiniChat
          channelId={chatChannel!.id}
          serverId={activeServerId!}
          channelName={chatChannel!.name}
        />
      )}

      {modals}
    </div>
  );
}
