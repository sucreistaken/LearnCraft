import { useEffect } from "react";
import { useMessageStore } from "../../../stores/messageStore";
import MessageList from "./MessageList";
import MessageInput from "./MessageInput";

const LOBBY_CHANNEL_ID = "global-lobby";
const LOBBY_SERVER_ID = "lobby";

export default function LobbyChat() {
  const loadMessages = useMessageStore((s) => s.loadMessages);

  useEffect(() => {
    loadMessages(LOBBY_CHANNEL_ID);
  }, []);

  return (
    <div className="sh-lobby-chat">
      <div className="sh-lobby-chat__header">
        <span className="sh-lobby-chat__icon">💬</span>
        <h3 className="sh-lobby-chat__title">Genel Sohbet</h3>
        <span className="sh-lobby-chat__subtitle">Herkesle sohbet et</span>
      </div>
      <div className="sh-lobby-chat__body">
        <MessageList channelId={LOBBY_CHANNEL_ID} />
      </div>
      <div className="sh-lobby-chat__footer">
        <MessageInput
          channelId={LOBBY_CHANNEL_ID}
          serverId={LOBBY_SERVER_ID}
          channelName="genel-sohbet"
          disabled={false}
        />
      </div>
    </div>
  );
}
