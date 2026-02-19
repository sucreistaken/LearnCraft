import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useServerStore } from "../../../stores/serverStore";
import { useProfileStore } from "../../../stores/profileStore";
import type { ServerTemplate } from "../../../types";

const COLORS = [
  "#6C5CE7", "#00B894", "#FDCB6E", "#E17055", "#0984E3",
  "#D63031", "#A29BFE", "#55A3E8", "#F78FB3", "#3DC1D3",
];

const BUILT_IN_TEMPLATES: ServerTemplate[] = [
  {
    id: "study-group",
    label: "Ders Çalışma Odası",
    description: "Ders çalışma araçları ve sohbet",
    categories: [
      { name: "Genel", channels: [{ name: "genel", type: "text" }, { name: "duyurular", type: "announcement" }, { name: "kaynaklar", type: "text" }] },
      { name: "Çalışma Araçları", channels: [{ name: "deep-dive", type: "study-tool", toolType: "deep-dive" }, { name: "flashcards", type: "study-tool", toolType: "flashcards" }, { name: "quiz-yarışması", type: "study-tool", toolType: "quiz" }, { name: "zihin-haritası", type: "study-tool", toolType: "mind-map" }] },
      { name: "Sprint", channels: [{ name: "pomodoro", type: "study-tool", toolType: "sprint" }, { name: "notlar", type: "study-tool", toolType: "notes" }] },
    ],
  },
  {
    id: "exam-prep",
    label: "Sınav Hazırlık Odası",
    description: "Sınav hazırlığı için odaklanmış çalışma ortamı",
    categories: [
      { name: "Genel", channels: [{ name: "genel", type: "text" }, { name: "sınav-tarihi", type: "announcement" }] },
      { name: "Soru Çözüm", channels: [{ name: "soru-cevap", type: "text" }, { name: "deep-dive", type: "study-tool", toolType: "deep-dive" }] },
      { name: "Yarışma", channels: [{ name: "quiz-yarışması", type: "study-tool", toolType: "quiz" }, { name: "flashcards", type: "study-tool", toolType: "flashcards" }] },
      { name: "Özet", channels: [{ name: "notlar", type: "study-tool", toolType: "notes" }, { name: "zihin-haritası", type: "study-tool", toolType: "mind-map" }] },
    ],
  },
  {
    id: "project-group",
    label: "Proje Odası",
    description: "Proje çalışması için organize çalışma alanı",
    categories: [
      { name: "Genel", channels: [{ name: "genel", type: "text" }, { name: "görevler", type: "announcement" }] },
      { name: "Çalışma", channels: [{ name: "deep-dive", type: "study-tool", toolType: "deep-dive" }, { name: "notlar", type: "study-tool", toolType: "notes" }] },
      { name: "Sprint", channels: [{ name: "pomodoro", type: "study-tool", toolType: "sprint" }] },
    ],
  },
];

const TEMPLATE_ICONS: Record<string, string> = {
  "study-group": "📚",
  "exam-prep": "📝",
  "project-group": "💻",
};

const CHANNEL_TYPE_ICONS: Record<string, string> = {
  text: "#",
  announcement: "📢",
  "study-tool": "🔧",
};

const TOOL_ICONS: Record<string, string> = {
  "deep-dive": "🔍",
  flashcards: "🗂️",
  quiz: "❓",
  "mind-map": "🧠",
  sprint: "⏱️",
  notes: "📝",
};

interface Props {
  open: boolean;
  onClose: () => void;
}

type ModalTab = "create" | "join";
type Step = "purpose" | "details" | "preview";

export default function CreateServerModal({ open, onClose }: Props) {
  const [tab, setTab] = useState<ModalTab>("create");
  const [step, setStep] = useState<Step>("purpose");
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  // Details form
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [university, setUniversity] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [isPublic, setIsPublic] = useState(false);

  // Join tab
  const [inviteCode, setInviteCode] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const createServer = useServerStore((s) => s.createServer);
  const selectServer = useServerStore((s) => s.selectServer);
  const joinByInvite = useServerStore((s) => s.joinByInvite);
  const profile = useProfileStore((s) => s.profile);

  const reset = () => {
    setStep("purpose");
    setSelectedTemplate(null);
    setName("");
    setDescription("");
    setColor(COLORS[0]);
    setUniversity("");
    setTagsInput("");
    setIsPublic(false);
    setInviteCode("");
    setError("");
    setLoading(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSelectTemplate = (templateId: string | null) => {
    setSelectedTemplate(templateId);
    setStep("details");
  };

  const handleCreate = async () => {
    if (!name.trim() || !profile) return;
    setLoading(true);
    setError("");
    try {
      const tags = tagsInput
        .split(",")
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);

      const server = await createServer(
        name.trim(),
        description.trim(),
        profile.id,
        color,
        {
          tags,
          university: university.trim() || undefined,
          isPublic,
          templateId: selectedTemplate || undefined,
        }
      );
      await selectServer(server.id);
      handleClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!inviteCode.trim() || !profile) return;
    setLoading(true);
    setError("");
    try {
      const server = await joinByInvite(inviteCode.trim(), profile.id);
      await selectServer(server.id);
      handleClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const currentTemplate = BUILT_IN_TEMPLATES.find((t) => t.id === selectedTemplate);

  const renderPurposeStep = () => (
    <>
      <h3 style={{ margin: "0 0 4px", fontSize: "var(--text-lg)" }}>Nasıl bir çalışma odası oluşturmak istiyorsunuz?</h3>
      <p style={{ opacity: 0.6, marginBottom: "var(--space-4)", fontSize: "var(--text-sm)" }}>
        Bir şablon seçin veya boş oda oluşturun
      </p>

      <div className="sh-template-list">
        {BUILT_IN_TEMPLATES.map((tmpl) => (
          <div
            key={tmpl.id}
            className="sh-template-card"
            onClick={() => handleSelectTemplate(tmpl.id)}
          >
            <span className="sh-template-card__icon">{TEMPLATE_ICONS[tmpl.id] || "📁"}</span>
            <div className="sh-template-card__info">
              <span className="sh-template-card__name">{tmpl.label}</span>
              <span className="sh-template-card__desc">{tmpl.description}</span>
            </div>
            <span className="sh-template-card__arrow">→</span>
          </div>
        ))}
        <div
          className="sh-template-card sh-template-card--empty"
          onClick={() => handleSelectTemplate(null)}
        >
          <span className="sh-template-card__icon">✨</span>
          <div className="sh-template-card__info">
            <span className="sh-template-card__name">Boş Oda</span>
            <span className="sh-template-card__desc">Sıfırdan başla, kendi araçlarını ekle</span>
          </div>
          <span className="sh-template-card__arrow">→</span>
        </div>
      </div>
    </>
  );

  const renderDetailsStep = () => (
    <>
      <button className="sh-back-btn" onClick={() => setStep("purpose")}>← Geri</button>

      <div className="mb-3">
        <label className="sh-label">Oda Adı</label>
        <input
          className="input w-full"
          placeholder="Ör: Matematik 101 - 2025 Bahar"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={32}
          autoFocus
        />
      </div>

      <div className="mb-3">
        <label className="sh-label">Açıklama (opsiyonel)</label>
        <textarea
          className="lc-textarea w-full"
          placeholder="Bu sunucu ne hakkında?"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          maxLength={200}
        />
      </div>

      <div className="mb-3">
        <label className="sh-label">Üniversite (opsiyonel)</label>
        <input
          className="input w-full"
          placeholder="Ör: İTÜ, ODTÜ, Boğaziçi"
          value={university}
          onChange={(e) => setUniversity(e.target.value)}
          maxLength={50}
        />
      </div>

      <div className="mb-3">
        <label className="sh-label">Etiketler (virgülle ayırın)</label>
        <input
          className="input w-full"
          placeholder="Ör: matematik, lineer cebir, mühendislik"
          value={tagsInput}
          onChange={(e) => setTagsInput(e.target.value)}
          maxLength={100}
        />
      </div>

      <div className="mb-3">
        <label className="sh-label">Renk</label>
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

      <div className="mb-4 sh-toggle-row">
        <label className="sh-label" style={{ marginBottom: 0 }}>Herkese Açık</label>
        <button
          type="button"
          className={`sh-toggle ${isPublic ? "sh-toggle--active" : ""}`}
          onClick={() => setIsPublic(!isPublic)}
        >
          <span className="sh-toggle__knob" />
        </button>
        <span style={{ fontSize: "var(--text-xs)", opacity: 0.5 }}>
          {isPublic ? "Herkes keşfedebilir ve katılabilir" : "Sadece davet ile katılım"}
        </span>
      </div>

      {error && <p style={{ color: "var(--danger)", marginBottom: 12 }}>{error}</p>}

      <div className="sh-modal-actions">
        <button className="btn btn--ghost" onClick={handleClose}>İptal</button>
        {selectedTemplate ? (
          <button
            className="btn btn--primary"
            onClick={() => setStep("preview")}
            disabled={!name.trim()}
          >
            Önizle
          </button>
        ) : (
          <button
            className="btn btn--primary"
            onClick={handleCreate}
            disabled={!name.trim() || loading}
          >
            {loading ? "Oluşturuluyor..." : "Oluştur"}
          </button>
        )}
      </div>
    </>
  );

  const renderPreviewStep = () => (
    <>
      <button className="sh-back-btn" onClick={() => setStep("details")}>← Geri</button>

      <h3 style={{ margin: "0 0 var(--space-2)", fontSize: "var(--text-lg)" }}>Önizleme</h3>
      <p style={{ opacity: 0.6, marginBottom: "var(--space-4)", fontSize: "var(--text-sm)" }}>
        Oluşturulacak araçlar:
      </p>

      <div className="sh-preview-server">
        <div className="sh-preview-server__header" style={{ background: color }}>
          <span>{name.charAt(0).toUpperCase()}</span>
          <strong>{name}</strong>
        </div>

        {currentTemplate?.categories.map((cat, catIdx) => (
          <div key={catIdx} className="sh-preview-category">
            <div className="sh-preview-category__name">{cat.name.toUpperCase()}</div>
            {cat.channels.map((ch, chIdx) => (
              <div key={chIdx} className="sh-preview-channel">
                <span className="sh-preview-channel__icon">
                  {ch.toolType
                    ? TOOL_ICONS[ch.toolType] || "🔧"
                    : CHANNEL_TYPE_ICONS[ch.type] || "#"}
                </span>
                <span>{ch.name}</span>
              </div>
            ))}
          </div>
        ))}

        {isPublic && (
          <div className="sh-preview-badge">Herkese Açık</div>
        )}
      </div>

      {error && <p style={{ color: "var(--danger)", marginBottom: 12 }}>{error}</p>}

      <div className="sh-modal-actions">
        <button className="btn btn--ghost" onClick={handleClose}>İptal</button>
        <button
          className="btn btn--primary"
          onClick={handleCreate}
          disabled={loading}
        >
          {loading ? "Oluşturuluyor..." : "Oluştur"}
        </button>
      </div>
    </>
  );

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleClose}
        >
          <motion.div
            className="modal"
            initial={{ scale: 0.85, y: 20, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.85, y: 20, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 22 }}
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 500 }}
          >
            {/* Tab switcher */}
            <div className="sh-modal-tabs" style={{ position: "relative" }}>
              <button
                className={`sh-modal-tab ${tab === "create" ? "sh-modal-tab--active" : ""}`}
                onClick={() => { setTab("create"); setError(""); setStep("purpose"); }}
              >
                Oda Oluştur
                {tab === "create" && (
                  <motion.div
                    layoutId="tab-indicator"
                    className="sh-modal-tab__indicator"
                    style={{
                      position: "absolute",
                      bottom: 0,
                      left: 0,
                      right: 0,
                      height: 2,
                      background: "var(--accent-2)",
                      borderRadius: 1,
                    }}
                    transition={{ type: "spring", stiffness: 400, damping: 28 }}
                  />
                )}
              </button>
              <button
                className={`sh-modal-tab ${tab === "join" ? "sh-modal-tab--active" : ""}`}
                onClick={() => { setTab("join"); setError(""); }}
              >
                Odaya Katıl
                {tab === "join" && (
                  <motion.div
                    layoutId="tab-indicator"
                    className="sh-modal-tab__indicator"
                    style={{
                      position: "absolute",
                      bottom: 0,
                      left: 0,
                      right: 0,
                      height: 2,
                      background: "var(--accent-2)",
                      borderRadius: 1,
                    }}
                    transition={{ type: "spring", stiffness: 400, damping: 28 }}
                  />
                )}
              </button>
            </div>

            {tab === "create" ? (
              <>
                {step === "purpose" && renderPurposeStep()}
                {step === "details" && renderDetailsStep()}
                {step === "preview" && renderPreviewStep()}
              </>
            ) : (
              <>
                <div className="mb-4">
                  <label className="sh-label">Davet Kodu</label>
                  <input
                    className="input w-full"
                    placeholder="Ör: ABC123"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                    maxLength={6}
                    style={{ textTransform: "uppercase", letterSpacing: 4, fontSize: "1.2em", textAlign: "center" }}
                  />
                </div>

                {error && <p style={{ color: "var(--danger)", marginBottom: 12 }}>{error}</p>}

                <div className="sh-modal-actions">
                  <button className="btn btn--ghost" onClick={handleClose}>İptal</button>
                  <button
                    className="btn btn--primary"
                    onClick={handleJoin}
                    disabled={inviteCode.length < 4 || loading}
                  >
                    {loading ? "Katılınıyor..." : "Katıl"}
                  </button>
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
