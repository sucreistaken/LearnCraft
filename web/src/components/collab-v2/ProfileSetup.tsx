import { useState } from "react";
import { motion } from "framer-motion";
import { useProfileStore } from "../../stores/profileStore";

const COLORS = [
  "#6C5CE7", "#00B894", "#FDCB6E", "#E17055", "#0984E3",
  "#D63031", "#A29BFE", "#55A3E8", "#F78FB3", "#3DC1D3",
];

export default function ProfileSetup() {
  const [nickname, setNickname] = useState("");
  const [color, setColor] = useState(COLORS[Math.floor(Math.random() * COLORS.length)]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const createProfile = useProfileStore((s) => s.createProfile);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname.trim() || nickname.trim().length < 2) {
      setError("Takma ad en az 2 karakter olmalıdır.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await createProfile(nickname.trim(), color);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="sh-profile-setup">
      <motion.div
        className="sh-profile-setup__card"
        initial={{ y: 30, scale: 0.9, rotate: -1, opacity: 0 }}
        animate={{ y: 0, scale: 1, rotate: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
      >
        <div className="sh-profile-setup__brand">📚</div>
        <h2 className="sh-profile-setup__title">Study Hub'a Hoş Geldin!</h2>
        <p className="sh-profile-setup__subtitle">
          Birlikte çalışmaya başlamak için bir profil oluştur
        </p>

        {/* Steps indicator */}
        <div className="sh-profile-setup__steps">
          <div className="sh-step sh-step--active">
            <div className="sh-step__number">1</div>
            <span className="sh-step__label">Profil Oluştur</span>
          </div>
          <div className="sh-step__line" />
          <div className="sh-step">
            <div className="sh-step__number">2</div>
            <span className="sh-step__label">Sunucuya Katıl</span>
          </div>
          <div className="sh-step__line" />
          <div className="sh-step">
            <div className="sh-step__number">3</div>
            <span className="sh-step__label">Birlikte Çalış</span>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label className="sh-label">Takma Ad</label>
            <input
              className="input w-full sh-input--lg"
              placeholder="Ör: Kadir"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              maxLength={20}
              autoFocus
            />
          </div>

          <div className="mb-4">
            <label className="sh-label">Avatar Rengi</label>
            <div className="sh-color-picker">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`sh-color-swatch ${color === c ? "sh-color-swatch--active" : ""}`}
                  style={{ background: c }}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
          </div>

          {/* Preview */}
          <motion.div
            className="sh-profile-setup__preview"
            animate={{ borderColor: color + "40" }}
            transition={{ duration: 0.3 }}
          >
            <motion.div
              className="sh-profile-setup__avatar"
              style={{ background: color }}
              animate={{ scale: nickname ? 1 : 0.9 }}
              transition={{ duration: 0.2 }}
            >
              {(nickname || "?").charAt(0).toUpperCase()}
            </motion.div>
            <div>
              <span className="sh-profile-setup__preview-name">
                {nickname || "Takma Ad"}
              </span>
              <span className="sh-profile-setup__preview-status">Çevrimiçi</span>
            </div>
          </motion.div>

          {error && (
            <motion.p
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              style={{ color: "var(--danger)", marginBottom: 12, fontSize: "var(--text-sm)" }}
            >
              {error}
            </motion.p>
          )}

          <button
            type="submit"
            className="btn btn--primary w-full sh-btn--lg"
            disabled={!nickname.trim() || loading}
          >
            {loading ? (
              <span className="sh-btn-spinner" />
            ) : (
              "Başla →"
            )}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
