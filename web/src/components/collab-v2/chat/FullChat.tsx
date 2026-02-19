import { useEffect } from "react";
import { useMessageStore } from "../../../stores/messageStore";
import MessageList from "./MessageList";
import MessageInput from "./MessageInput";

interface Props {
  channelId: string;
  serverId: string;
  channelName: string;
  memberCount?: number;
  readOnly?: boolean;
}

export default function FullChat({ channelId, serverId, channelName, memberCount, readOnly }: Props) {
  const loadMessages = useMessageStore((s) => s.loadMessages);

  useEffect(() => {
    if (channelId) {
      loadMessages(channelId);
    }
  }, [channelId]);

  return (
    <div className="sh-full-chat">
      {/* Header */}
      <div className="sh-full-chat__header">
        <div className="sh-full-chat__header-left">
          <span className="sh-full-chat__hash">#</span>
          <h3 className="sh-full-chat__channel-name">{channelName}</h3>
        </div>
        {memberCount != null && (
          <span className="sh-full-chat__member-count">{memberCount} üye</span>
        )}
      </div>

      {/* Messages */}
      <div className="sh-full-chat__body">
        <MessageList channelId={channelId} />
      </div>

      {/* Input */}
      {!readOnly && (
        <div className="sh-full-chat__footer">
          <MessageInput
            channelId={channelId}
            serverId={serverId}
            channelName={channelName}
            disabled={false}
          />
        </div>
      )}

      {readOnly && (
        <div className="sh-full-chat__readonly">
          Bu kanal sadece duyurular içindir.
        </div>
      )}
    </div>
  );
}
