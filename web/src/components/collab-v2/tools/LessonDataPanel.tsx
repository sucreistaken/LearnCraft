import { useState, useEffect } from "react";
import type { LessonDetailData } from "../../../types";
import { channelToolApi } from "../../../services/channelToolApi";

interface Props {
  channelId: string;
  open: boolean;
}

type TabId = "modules" | "emphases" | "cheatsheet" | "lo-modules" | "outcomes";
type LoModule = NonNullable<NonNullable<LessonDetailData["lesson"]>["loModules"]>[number];

const TAB_LABELS: Record<TabId, string> = {
  modules: "Moduller",
  emphases: "Vurgular",
  cheatsheet: "Cheat Sheet",
  "lo-modules": "LO Modulleri",
  outcomes: "Ogrenme Ciktilari",
};

export default function LessonDataPanel({ channelId, open }: Props) {
  const [data, setData] = useState<LessonDetailData | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>("modules");
  const [selectedLo, setSelectedLo] = useState(0);

  useEffect(() => {
    setData(null);
    setSelectedLo(0);
    if (!open) return;

    let stale = false;
    setLoading(true);
    channelToolApi
      .getLessonDetail(channelId)
      .then((d) => { if (!stale) setData(d); })
      .catch(() => { if (!stale) setData(null); })
      .finally(() => { if (!stale) setLoading(false); });

    return () => { stale = true; };
  }, [open, channelId]);

  if (!open) return null;

  if (loading) {
    return (
      <div className="sh-lesson-panel">
        <div className="sh-lesson-panel__loading">
          <div className="sh-btn-spinner" />
          <span>Ders verisi yukleniyor...</span>
        </div>
      </div>
    );
  }

  if (!data?.linked || !data.lesson) {
    return null;
  }

  const lesson = data.lesson;

  // Build available tabs
  const tabs: TabId[] = [];
  if (lesson.modules?.length) tabs.push("modules");
  if (lesson.emphases?.length) tabs.push("emphases");
  if (lesson.cheatSheet) tabs.push("cheatsheet");
  if (lesson.loModules?.length) tabs.push("lo-modules");
  if (lesson.learningOutcomes?.length) tabs.push("outcomes");

  if (tabs.length === 0) {
    return (
      <div className="sh-lesson-panel">
        <div className="sh-lesson-panel__empty">Ders verisi bulunamadi.</div>
      </div>
    );
  }

  // Ensure activeTab is valid
  const currentTab = tabs.includes(activeTab) ? activeTab : tabs[0];

  return (
    <div className="sh-lesson-panel">
      <div className="sh-lesson-panel__header">
        <span className="sh-lesson-panel__title">{lesson.title}</span>
        {lesson.keyConcepts.length > 0 && (
          <div className="sh-lesson-panel__concepts">
            {lesson.keyConcepts.slice(0, 5).map((c) => (
              <span key={c} className="sh-lesson-panel__concept-tag">{c}</span>
            ))}
          </div>
        )}
      </div>

      <div className="sh-lesson-panel__tabs">
        {tabs.map((t) => (
          <button
            key={t}
            className={`sh-lesson-panel__tab${currentTab === t ? " sh-lesson-panel__tab--active" : ""}`}
            onClick={() => setActiveTab(t)}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      <div className="sh-lesson-panel__content">
        {currentTab === "modules" && lesson.modules && (
          <div className="sh-lesson-panel__modules">
            {lesson.modules.map((m, i) => (
              <div key={i} className="sh-lesson-panel__module-card">
                <div className="sh-lesson-panel__module-num">{i + 1}</div>
                <div>
                  <div className="sh-lesson-panel__module-title">{m.title}</div>
                  <div className="sh-lesson-panel__module-goal">{m.goal}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {currentTab === "emphases" && lesson.emphases && (
          <div className="sh-lesson-panel__emphases">
            {[...lesson.emphases]
              .sort((a, b) => b.confidence - a.confidence)
              .map((e, i) => (
                <div key={i} className="sh-lesson-panel__emphasis-card">
                  <div className="sh-lesson-panel__emphasis-header">
                    <span className="sh-lesson-panel__emphasis-statement">{e.statement}</span>
                    <span className="sh-lesson-panel__confidence-badge">
                      {Math.round(e.confidence * 100)}%
                    </span>
                  </div>
                  <div className="sh-lesson-panel__emphasis-why">{e.why}</div>
                  {e.evidence && (
                    <div className="sh-lesson-panel__emphasis-evidence">"{e.evidence}"</div>
                  )}
                </div>
              ))}
          </div>
        )}

        {currentTab === "cheatsheet" && lesson.cheatSheet && (
          <div className="sh-lesson-panel__cheatsheet">
            {lesson.cheatSheet.sections.map((s, i) => (
              <div key={i} className="sh-lesson-panel__cs-section">
                <h4>{s.heading}</h4>
                <ul className="sh-lesson-panel__cs-list">
                  {s.bullets.map((b, j) => <li key={j}>{b}</li>)}
                </ul>
              </div>
            ))}
            {lesson.cheatSheet.formulas.length > 0 && (
              <div className="sh-lesson-panel__cs-section">
                <h4>Formuller</h4>
                <ul className="sh-lesson-panel__cs-list sh-lesson-panel__cs-list--formula">
                  {lesson.cheatSheet.formulas.map((f, i) => <li key={i}>{f}</li>)}
                </ul>
              </div>
            )}
            {lesson.cheatSheet.pitfalls.length > 0 && (
              <div className="sh-lesson-panel__cs-section">
                <h4>Tuzaklar</h4>
                <ul className="sh-lesson-panel__cs-list sh-lesson-panel__cs-list--pitfall">
                  {lesson.cheatSheet.pitfalls.map((p, i) => <li key={i}>{p}</li>)}
                </ul>
              </div>
            )}
            {lesson.cheatSheet.quickQuiz.length > 0 && (
              <div className="sh-lesson-panel__cs-section">
                <h4>Hizli Quiz</h4>
                <div className="sh-lesson-panel__cs-quiz">
                  {lesson.cheatSheet.quickQuiz.map((qq, i) => (
                    <QuickQuizItem key={i} q={qq.q} a={qq.a} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {currentTab === "lo-modules" && lesson.loModules && (
          <div className="sh-lesson-panel__lo-layout">
            <div className="sh-lesson-panel__lo-sidebar">
              {lesson.loModules.map((lo, i) => (
                <button
                  key={lo.loId}
                  className={`sh-lesson-panel__lo-btn${selectedLo === i ? " sh-lesson-panel__lo-btn--active" : ""}`}
                  onClick={() => setSelectedLo(i)}
                >
                  <span className="sh-lesson-panel__lo-id">{lo.loId}</span>
                  <span className="sh-lesson-panel__lo-gist">{lo.oneLineGist}</span>
                </button>
              ))}
            </div>
            <div className="sh-lesson-panel__lo-detail">
              <LoModuleDetail module={lesson.loModules[Math.min(selectedLo, lesson.loModules.length - 1)]} />
            </div>
          </div>
        )}

        {currentTab === "outcomes" && lesson.learningOutcomes && (
          <div className="sh-lesson-panel__outcomes">
            {lesson.learningOutcomes.map((lo) => (
              <div key={lo.code} className="sh-lesson-panel__outcome-card">
                <span className="sh-lesson-panel__outcome-code">{lo.code}</span>
                <span>{lo.description}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function QuickQuizItem({ q, a }: { q: string; a: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="sh-lesson-panel__qq-item" onClick={() => setShow((s) => !s)}>
      <div className="sh-lesson-panel__qq-q">Q: {q}</div>
      {show && <div className="sh-lesson-panel__qq-a">A: {a}</div>}
    </div>
  );
}

function LoModuleDetail({ module: m }: { module: LoModule }) {
  if (!m) return null;
  return (
    <div className="sh-lesson-panel__lo-content">
      <h4>{m.loTitle}</h4>

      {m.coreIdeas.length > 0 && (
        <div className="sh-lesson-panel__lo-section">
          <h5>Temel Fikirler</h5>
          <ul>{m.coreIdeas.map((c, i) => <li key={i}>{c}</li>)}</ul>
        </div>
      )}

      {m.mustRemember.length > 0 && (
        <div className="sh-lesson-panel__lo-section sh-lesson-panel__lo-section--must">
          <h5>Mutlaka Hatirla</h5>
          <ul>{m.mustRemember.map((r, i) => <li key={i}>{r}</li>)}</ul>
        </div>
      )}

      {m.commonTraps.length > 0 && (
        <div className="sh-lesson-panel__lo-section sh-lesson-panel__lo-section--trap">
          <h5>Sik Yapilan Hatalar</h5>
          <ul>{m.commonTraps.map((t, i) => <li key={i}>{t}</li>)}</ul>
        </div>
      )}

      {m.examples.length > 0 && (
        <div className="sh-lesson-panel__lo-section">
          <h5>Ornekler</h5>
          {m.examples.map((ex, i) => (
            <div key={i} className="sh-lesson-panel__lo-example">
              <strong>{ex.label}:</strong> {ex.description}
            </div>
          ))}
        </div>
      )}

      {m.miniQuiz.length > 0 && (
        <div className="sh-lesson-panel__lo-section">
          <h5>Mini Quiz</h5>
          {m.miniQuiz.map((mq, i) => (
            <QuickQuizItem key={i} q={mq.question} a={`${mq.answer} — ${mq.why}`} />
          ))}
        </div>
      )}
    </div>
  );
}
