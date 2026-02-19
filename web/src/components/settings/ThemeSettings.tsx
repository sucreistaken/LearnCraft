import React from "react";
import { useUiStore } from "../../stores/uiStore";

export default function ThemeSettings() {
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);

  return (
    <div className="settings-section">
      <h3 className="settings-section__title">Appearance</h3>

      <div className="settings-group">
        <label>Theme</label>
        <div className="settings-radio-group">
          <label className={`settings-radio ${theme === "dark" ? "settings-radio--active" : ""}`}>
            <input
              type="radio"
              name="theme"
              value="dark"
              checked={theme === "dark"}
              onChange={() => setTheme("dark")}
            />
            <span className="settings-radio__label">Dark</span>
          </label>
          <label className={`settings-radio ${theme === "light" ? "settings-radio--active" : ""}`}>
            <input
              type="radio"
              name="theme"
              value="light"
              checked={theme === "light"}
              onChange={() => setTheme("light")}
            />
            <span className="settings-radio__label">Light</span>
          </label>
        </div>
      </div>
    </div>
  );
}
