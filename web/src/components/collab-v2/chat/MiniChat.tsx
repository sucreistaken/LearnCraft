import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMessageStore } from "../../../stores/messageStore";
import MessageList from "./MessageList";
import MessageInput from "./MessageInput";

interface Props {
  channelId: string;
  serverId: string;
  channelName: string;
}

export default function MiniChat({ channelId, serverId, channelName }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const loadMessages = useMessageStore((s) => s.loadMessages);

  useEffect(() => {
    if (channelId) {
      loadMessages(channelId);
    }
  }, [channelId]);

  return (
    <>
      {/* Floating toggle button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            className="sh-mini-chat__toggle"
            onClick={() => setIsOpen(true)}
            title={`#${channelName} sohbeti`}
            whileHover={{ scale: 1.1, rotate: 10 }}
            whileTap={{ scale: 0.9 }}
            transition={{ type: "spring", stiffness: 400, damping: 17 }}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
          >
            💬
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="sh-mini-chat sh-mini-chat--open"
            initial={{ scale: 0.8, y: 20, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.8, y: 20, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
          >
            <div className="sh-mini-chat__header">
              <span className="sh-mini-chat__header-icon">#</span>
              <span className="sh-mini-chat__header-name">{channelName}</span>
              <button
                className="sh-mini-chat__close"
                onClick={() => setIsOpen(false)}
                title="Küçült"
              >
                ✕
              </button>
            </div>
            <div className="sh-mini-chat__body">
              <MessageList channelId={channelId} />
            </div>
            <div className="sh-mini-chat__footer">
              <MessageInput
                channelId={channelId}
                serverId={serverId}
                channelName={channelName}
                disabled={false}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
