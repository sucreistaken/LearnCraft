// src/components/ui/NotificationBell.tsx
import React, { useEffect, useRef, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useNotificationStore } from "../../stores/notificationStore";
import { useUiStore } from "../../stores/uiStore";
import { getSocket } from "../../services/socket";
import type { AppNotification, ModeId } from "../../types";

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const severityColors: Record<string, string> = {
  critical: "var(--danger, #ef4444)",
  warning: "var(--warning, #f59e0b)",
  info: "var(--accent, #6366f1)",
};

export default function NotificationBell() {
  const store = useNotificationStore();
  const setMode = useUiStore((s) => s.setMode);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Socket listeners
  useEffect(() => {
    const sock = getSocket();

    const handleNewNotif = (notif: AppNotification) => {
      store.prependNotification(notif);
      store.setUnreadCount(store.unreadCount + 1);
    };

    const handleBadgeUpdate = (data: { count: number }) => {
      store.setUnreadCount(data.count);
    };

    sock.on("notification:new", handleNewNotif);
    sock.on("notification:badge-update", handleBadgeUpdate);

    // Request initial count
    sock.emit("notification:request-count");

    return () => {
      sock.off("notification:new", handleNewNotif);
      sock.off("notification:badge-update", handleBadgeUpdate);
    };
  }, []);

  // Fetch on mount
  useEffect(() => {
    store.fetchNotifications();
    store.fetchUnreadCount();
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        store.setDropdownOpen(false);
      }
    };
    if (store.dropdownOpen) {
      document.addEventListener("mousedown", handler);
      return () => document.removeEventListener("mousedown", handler);
    }
  }, [store.dropdownOpen]);

  const handleClick = useCallback((notif: AppNotification) => {
    if (!notif.dismissed) {
      store.dismissNotification(notif.id);
    }
    if (notif.actionTarget?.mode) {
      setMode(notif.actionTarget.mode as ModeId);
      store.setDropdownOpen(false);
    }
  }, [setMode, store]);

  const displayNotifs = store.notifications.slice(0, 20);

  return (
    <div className="notification-bell" ref={dropdownRef}>
      <button
        className="notification-bell__btn"
        onClick={() => store.toggleDropdown()}
        aria-label={`Notifications${store.unreadCount > 0 ? ` (${store.unreadCount} unread)` : ""}`}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {store.unreadCount > 0 && (
          <span className="notification-bell__badge">
            {store.unreadCount > 9 ? "9+" : store.unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {store.dropdownOpen && (
          <motion.div
            className="notification-bell__dropdown"
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.15 }}
          >
            <div className="notification-bell__dropdown-header">
              <span className="notification-bell__dropdown-title">Notifications</span>
              {store.unreadCount > 0 && (
                <span className="notification-bell__dropdown-count">{store.unreadCount} unread</span>
              )}
            </div>
            <div className="notification-bell__dropdown-list">
              {displayNotifs.length === 0 && (
                <div className="notification-bell__empty">No notifications</div>
              )}
              {displayNotifs.map((notif) => (
                <div
                  key={notif.id}
                  className={`notification-bell__item${!notif.dismissed ? " notification-bell__item--unread" : ""}`}
                  onClick={() => handleClick(notif)}
                >
                  <div
                    className="notification-bell__item-title"
                    style={{ color: !notif.dismissed ? severityColors[notif.severity] : undefined }}
                  >
                    {notif.title}
                  </div>
                  <div className="notification-bell__item-message">{notif.message}</div>
                  <div className="notification-bell__item-time">{timeAgo(notif.createdAt)}</div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
