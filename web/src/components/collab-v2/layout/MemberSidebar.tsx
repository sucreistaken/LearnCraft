import { useServerStore } from "../../../stores/serverStore";
import type { ServerMemberInfo } from "../../../types";

const STATUS_COLORS: Record<string, string> = {
  online: "#00B894",
  studying: "#6C5CE7",
  idle: "#FDCB6E",
  dnd: "#E17055",
  offline: "#636E72",
};

const STATUS_LABELS: Record<string, string> = {
  online: "Çevrimiçi",
  studying: "Çalışıyor",
  idle: "Boşta",
  dnd: "Rahatsız Etmeyin",
  offline: "Çevrimdışı",
};

export default function MemberSidebar() {
  const members = useServerStore((s) => s.members);
  const servers = useServerStore((s) => s.servers);
  const activeServerId = useServerStore((s) => s.activeServerId);
  const server = activeServerId ? servers.find((s) => s.id === activeServerId) ?? null : null;

  if (!server) return null;

  const online = members.filter((m) => m.status !== "offline");
  const offline = members.filter((m) => m.status === "offline");

  const getRoleName = (member: ServerMemberInfo): string | null => {
    const roleId = member.roles?.[0];
    if (!roleId) return null;
    const role = server.roles?.find((r) => r.id === roleId);
    return role?.name || null;
  };

  const getRoleColor = (member: ServerMemberInfo): string | undefined => {
    const roleId = member.roles?.[0];
    if (!roleId) return undefined;
    const role = server.roles?.find((r) => r.id === roleId);
    return role?.color;
  };

  const renderMember = (member: ServerMemberInfo) => (
    <div key={member.id} className="sh-member" title={STATUS_LABELS[member.status]}>
      <div className="sh-member__avatar" style={{ background: member.avatar }}>
        <span>{member.nickname.charAt(0).toUpperCase()}</span>
        <div
          className="sh-member__status-dot"
          style={{ background: STATUS_COLORS[member.status] }}
        />
      </div>
      <div className="sh-member__info">
        <span
          className="sh-member__name"
          style={{ color: getRoleColor(member) }}
        >
          {member.nickname}
        </span>
        {getRoleName(member) && getRoleName(member) !== "Member" && (
          <span className="sh-member__role">{getRoleName(member)}</span>
        )}
      </div>
    </div>
  );

  return (
    <div className="sh-member-sidebar">
      {online.length > 0 && (
        <div className="sh-member-group">
          <h4 className="sh-member-group__title">
            AKTİF — {online.length}
          </h4>
          {online.map(renderMember)}
        </div>
      )}
      {offline.length > 0 && (
        <div className="sh-member-group">
          <h4 className="sh-member-group__title">
            ÇEVRİMDIŞI — {offline.length}
          </h4>
          {offline.map(renderMember)}
        </div>
      )}
    </div>
  );
}
