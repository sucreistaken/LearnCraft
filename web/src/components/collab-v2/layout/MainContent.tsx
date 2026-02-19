import { useServerStore } from "../../../stores/serverStore";
import { useProfileStore } from "../../../stores/profileStore";
import ServerDiscovery from "../server/ServerDiscovery";
import ChannelToolRouter from "../tools/ChannelToolRouter";
import FullChat from "../chat/FullChat";

interface Props {
  onCreateServer?: () => void;
  onNavigate?: (panel: number) => void;
  isMobile?: boolean;
}

export default function MainContent({ onCreateServer, onNavigate, isMobile }: Props) {
  const activeChannelId = useServerStore((s) => s.activeChannelId);
  const channels = useServerStore((s) => s.channels);
  const activeServerId = useServerStore((s) => s.activeServerId);
  const servers = useServerStore((s) => s.servers);
  const activeChannel = activeChannelId ? channels.find((c) => c.id === activeChannelId) ?? null : null;
  const activeServer = activeServerId ? servers.find((s) => s.id === activeServerId) ?? null : null;
  const profile = useProfileStore((s) => s.profile);
  const members = useServerStore((s) => s.members);

  // No server selected -> show discovery / home view
  if (!activeServerId) {
    return <ServerDiscovery onCreateServer={onCreateServer} />;
  }

  const backButton = isMobile ? (
    <button className="sh-mobile-back" onClick={() => onNavigate?.(1)} title="Kanallara Dön">
      ← Kanallar
    </button>
  ) : null;

  // Active channel is a study-tool -> render tool full screen
  if (activeChannel && activeChannel.type === "study-tool" && activeChannel.toolType) {
    return (
      <div className="sh-main-content">
        {backButton}
        <ChannelToolRouter
          channel={activeChannel}
          serverId={activeServerId!}
          serverName={activeServer?.name || ""}
          userId={profile?.id || ""}
          nickname={profile?.nickname || ""}
        />
      </div>
    );
  }

  // Active channel is text or announcement -> render full chat
  if (activeChannel && (activeChannel.type === "text" || activeChannel.type === "announcement")) {
    return (
      <div className="sh-main-content">
        {backButton}
        <FullChat
          channelId={activeChannel.id}
          serverId={activeServerId!}
          channelName={activeChannel.name}
          memberCount={members.length}
          readOnly={activeChannel.type === "announcement"}
        />
      </div>
    );
  }

  // No tool selected -> show placeholder
  return (
    <div className="sh-main-content sh-main-content--empty">
      {backButton}
      <div className="sh-main-content__placeholder">
        <div className="sh-main-content__placeholder-icon">📚</div>
        <h2>Araç Seçin</h2>
        <p>Başlamak için sol taraftan bir çalışma aracı seçin.</p>
      </div>
    </div>
  );
}
