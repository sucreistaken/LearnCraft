// components/LoStudyPane.tsx
import React, { useState } from "react";

import { LoStudyModule } from "../types";

export default function LoStudyPane({
  modules,
}: {
  modules: LoStudyModule[];
}) {
  const [activeLoId, setActiveLoId] = useState<string | null>(
    modules[0]?.loId || null
  );

  const active = modules.find((m) => m.loId === activeLoId) || modules[0];

  return (
    <div className="lc-two-col">
      <aside className="lc-section ln-sidebar">
        <div className="panel__title mb-2">Learning Outcomes</div>
        <ol className="ol">
          {modules.map((m) => (
            <li
              key={m.loId}
              className={
                activeLoId === m.loId ? "lo-item lo-item--active" : "lo-item"
              }
              onClick={() => setActiveLoId(m.loId)}
            >
              <strong>{m.loId}</strong> – {m.loTitle}
            </li>
          ))}
        </ol>
      </aside>

      <div className="lc-section">
        <div className="panel__title mb-1">
          {active.loId} – {active.loTitle}
        </div>
        <p className="muted small mb-2">
          Önerilen çalışma süresi: {active.recommended_study_time_min} dk
        </p>

        <div className="card mb-2">
          <div className="label">Kısaca</div>
          <p>{active.oneLineGist}</p>
        </div>

        <div className="card mb-2">
          <div className="label">Çekirdek Fikirler</div>
          <ul className="ul">
            {active.coreIdeas.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </div>

        <div className="card mb-2">
          <div className="label">Mutlaka Hatırla</div>
          <ul className="ul">
            {active.mustRemember.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
        </div>

        <div className="card mb-2">
          <div className="label">Sezgisel Anlatım</div>
          <p>{active.intuitiveExplanation}</p>
        </div>

        <div className="card mb-2">
          <div className="label">Tipik Sorular</div>
          <ul className="ul">
            {active.typicalQuestions.map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ul>
        </div>

        <div className="card">
          <div className="label">Mini Quiz</div>
          <ul className="ul">
            {active.miniQuiz.map((q, i) => (
              <li key={i}>
                <strong>{q.question}</strong>
                <div className="small">
                  Cevap: {q.answer} — {q.why}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
