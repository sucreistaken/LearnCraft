import React, { useState } from "react";

export default function NotificationSettings() {
  const [notifications, setNotifications] = useState(true);
  const [sound, setSound] = useState(true);
  const [mentions, setMentions] = useState(true);

  return (
    <div className="settings-section">
      <h3 className="settings-section__title">Notifications</h3>

      <div className="settings-group">
        <div className="settings-toggle-row">
          <div>
            <div className="settings-toggle-label">Enable Notifications</div>
            <div className="settings-toggle-desc">Receive notifications for activity</div>
          </div>
          <button
            className={`settings-toggle ${notifications ? "settings-toggle--on" : ""}`}
            onClick={() => setNotifications(!notifications)}
          >
            <span className="settings-toggle__knob" />
          </button>
        </div>
      </div>

      <div className="settings-group">
        <div className="settings-toggle-row">
          <div>
            <div className="settings-toggle-label">Sound</div>
            <div className="settings-toggle-desc">Play sound for new notifications</div>
          </div>
          <button
            className={`settings-toggle ${sound ? "settings-toggle--on" : ""}`}
            onClick={() => setSound(!sound)}
          >
            <span className="settings-toggle__knob" />
          </button>
        </div>
      </div>

      <div className="settings-group">
        <div className="settings-toggle-row">
          <div>
            <div className="settings-toggle-label">Mentions Only</div>
            <div className="settings-toggle-desc">Only notify when you're mentioned</div>
          </div>
          <button
            className={`settings-toggle ${mentions ? "settings-toggle--on" : ""}`}
            onClick={() => setMentions(!mentions)}
          >
            <span className="settings-toggle__knob" />
          </button>
        </div>
      </div>
    </div>
  );
}
