import React, { useState } from "react";
import { useAuthStore } from "../../stores/authStore";
import { authApi } from "../../services/authApi";

export default function AccountSettings() {
  const logout = useAuthStore((s) => s.logout);
  const user = useAuthStore((s) => s.user);
  const [showDelete, setShowDelete] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    setLoading(true);
    setError("");
    try {
      await authApi.deleteAccount(deletePassword);
      logout();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="settings-section">
      <h3 className="settings-section__title">Account</h3>

      <div className="settings-group">
        <label>Email</label>
        <div className="settings-readonly">{user?.email || "—"}</div>
      </div>

      <div className="settings-group">
        <button className="settings-btn settings-btn--secondary" onClick={logout}>
          Sign Out
        </button>
      </div>

      <div className="settings-divider" />

      <div className="settings-group">
        <h4 className="settings-danger-title">Danger Zone</h4>
        {!showDelete ? (
          <button
            className="settings-btn settings-btn--danger"
            onClick={() => setShowDelete(true)}
          >
            Delete Account
          </button>
        ) : (
          <div className="settings-danger-confirm">
            <p className="settings-danger-text">
              This action cannot be undone. Enter your password to confirm.
            </p>
            {error && <div className="settings-message settings-message--error">{error}</div>}
            <input
              type="password"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              className="settings-input"
              placeholder="Your password"
            />
            <div className="settings-danger-actions">
              <button
                className="settings-btn settings-btn--danger"
                onClick={handleDelete}
                disabled={loading || !deletePassword}
              >
                {loading ? "Deleting..." : "Confirm Delete"}
              </button>
              <button
                className="settings-btn settings-btn--secondary"
                onClick={() => {
                  setShowDelete(false);
                  setDeletePassword("");
                  setError("");
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
