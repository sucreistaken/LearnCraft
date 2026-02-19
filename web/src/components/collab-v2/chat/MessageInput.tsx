import { useState, useRef, useCallback } from "react";
import toast from "react-hot-toast";
import { useMessageStore } from "../../../stores/messageStore";

interface Props {
  channelId: string;
  serverId: string;
  channelName: string;
  disabled: boolean;
}

export default function MessageInput({ channelId, serverId, channelName, disabled }: Props) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const sendMessage = useMessageStore((s) => s.sendMessage);
  const startTyping = useMessageStore((s) => s.startTyping);
  const stopTyping = useMessageStore((s) => s.stopTyping);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingEmitRef = useRef<number>(0);

  const handleSend = useCallback(async () => {
    if (!text.trim() || sending || disabled) return;
    setSending(true);
    try {
      await sendMessage(channelId, serverId, text.trim());
      setText("");
      stopTyping(channelId);
    } catch (err: any) {
      toast.error(err?.message || "Mesaj gönderilemedi");
    } finally {
      setSending(false);
    }
  }, [text, channelId, serverId, sending, disabled]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);

    // Throttled typing indicator (2 second throttle)
    const now = Date.now();
    if (now - lastTypingEmitRef.current > 2000) {
      startTyping(channelId);
      lastTypingEmitRef.current = now;
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      stopTyping(channelId);
    }, 3000);
  };

  return (
    <div className="sh-message-input">
      <div className="sh-message-input__wrapper">
        <textarea
          className="sh-message-input__textarea"
          placeholder={`#${channelName} kanalına mesaj gönder`}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          disabled={disabled || sending}
          rows={1}
        />
        <button
          className="sh-message-input__send"
          onClick={handleSend}
          disabled={!text.trim() || sending || disabled}
          title="Gönder"
        >
          ➤
        </button>
      </div>
    </div>
  );
}
