import { useEffect, useRef, useCallback } from "react";
import { useMessageStore } from "../../../stores/messageStore";
import MessageItem from "./MessageItem";

interface Props {
  channelId: string;
}

const EMPTY_MESSAGES: import("../../../types").ChannelMessage[] = [];
const EMPTY_TYPING: string[] = [];

export default function MessageList({ channelId }: Props) {
  const messages = useMessageStore((s) => s.messagesByChannel[channelId] ?? EMPTY_MESSAGES);
  const loading = useMessageStore((s) => s.loading);
  const hasMore = useMessageStore((s) => s.hasMore[channelId]);
  const loadMore = useMessageStore((s) => s.loadMore);
  const typingUsers = useMessageStore((s) => s.typingUsers[channelId] ?? EMPTY_TYPING);
  const bottomRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const prevLenRef = useRef(0);
  const isLoadingMoreRef = useRef(false);

  // Auto-scroll only on NEW messages (not on loadMore)
  useEffect(() => {
    if (messages.length > prevLenRef.current && !isLoadingMoreRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    prevLenRef.current = messages.length;
    isLoadingMoreRef.current = false;
  }, [messages.length]);

  const handleLoadMore = useCallback(async () => {
    if (!listRef.current) return;
    const container = listRef.current;
    const prevScrollHeight = container.scrollHeight;

    isLoadingMoreRef.current = true;
    await loadMore(channelId);

    // Preserve scroll position after loading older messages
    requestAnimationFrame(() => {
      const newScrollHeight = container.scrollHeight;
      container.scrollTop += newScrollHeight - prevScrollHeight;
    });
  }, [channelId, loadMore]);

  return (
    <div className="sh-message-list" ref={listRef}>
      {/* Load more button */}
      {hasMore && (
        <div className="sh-message-list__load-more">
          <button
            className="sh-message-list__load-btn"
            onClick={handleLoadMore}
            disabled={loading}
          >
            {loading ? "Yükleniyor..." : "Daha eski mesajları yükle"}
          </button>
        </div>
      )}

      {/* Messages */}
      {messages.length === 0 && !loading && (
        <div className="sh-message-list__empty">
          <p>Bu kanalda henüz mesaj yok.</p>
          <p style={{ opacity: 0.6 }}>Sohbeti başlatan ilk kişi olun!</p>
        </div>
      )}

      {messages.map((msg, i) => {
        const prevMsg = i > 0 ? messages[i - 1] : null;
        const isGrouped =
          prevMsg &&
          prevMsg.authorId === msg.authorId &&
          !msg.deleted &&
          !prevMsg.deleted &&
          new Date(msg.createdAt).getTime() - new Date(prevMsg.createdAt).getTime() < 5 * 60 * 1000;

        return (
          <MessageItem
            key={msg.id}
            message={msg}
            grouped={!!isGrouped}
            channelId={channelId}
          />
        );
      })}

      {/* Typing indicator */}
      {typingUsers.length > 0 && (
        <div className="sh-typing-indicator">
          <span className="sh-typing-indicator__dots">
            <span className="sh-typing-dot" />
            <span className="sh-typing-dot" />
            <span className="sh-typing-dot" />
          </span>
          <span className="sh-typing-indicator__text">
            {typingUsers.length === 1
              ? "Birisi yazıyor..."
              : `${typingUsers.length} kişi yazıyor...`}
          </span>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
