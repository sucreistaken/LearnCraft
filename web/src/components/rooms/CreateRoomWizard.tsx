import React, { useState, useEffect } from "react";
import { useRoomStore2 } from "../../stores/roomStore2";
import { useAuthStore } from "../../stores/authStore";
import type { ServerTemplate } from "../../types";

interface Props {
  onCreated: (roomId: string) => void;
  onCancel: () => void;
}

type Step = "info" | "template" | "settings";

export default function CreateRoomWizard({ onCreated, onCancel }: Props) {
  const [step, setStep] = useState<Step>("info");
  const [name, setName] = useState("");
  const [topic, setTopic] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [isPublic, setIsPublic] = useState(true);
  const [maxMembers, setMaxMembers] = useState(25);
  const [tags, setTags] = useState("");
  const [loading, setLoading] = useState(false);

  const createRoom = useRoomStore2((s) => s.createRoom);
  const templates = useRoomStore2((s) => s.templates);
  const loadTemplates = useRoomStore2((s) => s.loadTemplates);
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    if (templates.length === 0) loadTemplates();
  }, []);

  const handleCreate = async () => {
    if (!user || !name.trim()) return;
    setLoading(true);
    try {
      const room = await createRoom(name.trim(), topic.trim(), user.id, undefined, {
        isPublic,
        templateId: selectedTemplate || undefined,
        tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
      });
      onCreated(room.id);
    } catch {
      setLoading(false);
    }
  };

  return (
    <div className="sh-wizard-overlay" onClick={onCancel}>
      <div className="sh-wizard" onClick={(e) => e.stopPropagation()}>
        <div className="sh-wizard__header">
          <h2>Create Room</h2>
          <div className="sh-wizard__steps">
            <span className={step === "info" ? "sh-wizard__step--active" : ""}>1. Info</span>
            <span className={step === "template" ? "sh-wizard__step--active" : ""}>2. Template</span>
            <span className={step === "settings" ? "sh-wizard__step--active" : ""}>3. Settings</span>
          </div>
        </div>

        <div className="sh-wizard__body">
          {step === "info" && (
            <div className="sh-wizard__section">
              <div className="sh-wizard__field">
                <label>Room Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Calculus Study Group"
                  autoFocus
                />
              </div>
              <div className="sh-wizard__field">
                <label>Topic</label>
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="What will you study?"
                />
              </div>
              <div className="sh-wizard__field">
                <label>Tags (comma separated)</label>
                <input
                  type="text"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="math, calculus, exam"
                />
              </div>
            </div>
          )}

          {step === "template" && (
            <div className="sh-wizard__section">
              <p className="sh-wizard__hint">Choose a template or skip for defaults</p>
              <div className="sh-wizard__templates">
                {templates.map((t: ServerTemplate) => (
                  <button
                    key={t.id}
                    className={`sh-wizard__template ${selectedTemplate === t.id ? "sh-wizard__template--selected" : ""}`}
                    onClick={() => setSelectedTemplate(t.id === selectedTemplate ? null : t.id)}
                  >
                    <div className="sh-wizard__template-name">{t.label}</div>
                    <div className="sh-wizard__template-desc">{t.description}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === "settings" && (
            <div className="sh-wizard__section">
              <div className="sh-wizard__field">
                <label>
                  <input
                    type="checkbox"
                    checked={isPublic}
                    onChange={(e) => setIsPublic(e.target.checked)}
                  />{" "}
                  Public Room (visible in discovery)
                </label>
              </div>
              <div className="sh-wizard__field">
                <label>Max Members</label>
                <input
                  type="number"
                  value={maxMembers}
                  onChange={(e) => setMaxMembers(Number(e.target.value))}
                  min={1}
                  max={100}
                />
              </div>
            </div>
          )}
        </div>

        <div className="sh-wizard__footer">
          {step !== "info" && (
            <button
              className="sh-wizard__btn sh-wizard__btn--secondary"
              onClick={() => setStep(step === "settings" ? "template" : "info")}
            >
              Back
            </button>
          )}
          <div style={{ flex: 1 }} />
          <button className="sh-wizard__btn sh-wizard__btn--secondary" onClick={onCancel}>
            Cancel
          </button>
          {step !== "settings" ? (
            <button
              className="sh-wizard__btn"
              onClick={() => setStep(step === "info" ? "template" : "settings")}
              disabled={step === "info" && !name.trim()}
            >
              Next
            </button>
          ) : (
            <button className="sh-wizard__btn" onClick={handleCreate} disabled={loading || !name.trim()}>
              {loading ? "Creating..." : "Create Room"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
