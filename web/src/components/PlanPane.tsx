import React, { useState } from "react";
import { Plan, ModuleT ,LearningOutcome} from "../types";

/** Yardımcı fonksiyon: Dakikayı okunabilir formata çevirir */
function prettyMinutes(min?: number) {
  if (!min && min !== 0) return "";
  if (min < 60) return `${min} dk`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}s ${m} dk` : `${h}s`;
}

/** Zorluk Seviyesi Ayarları */
const diffConfig: Record<string, { label: string; style: React.CSSProperties }> = {
  Beginner: { label: "Başlangıç Seviyesi", style: { backgroundColor: "#e6f4ea", color: "#137333", border: "1px solid #ceead6" } },
  Intermediate: { label: "Orta Seviye", style: { backgroundColor: "#fef7e0", color: "#b06000", border: "1px solid #fce8b2" } },
  Advanced: { label: "İleri Seviye", style: { backgroundColor: "#fce8e6", color: "#c5221f", border: "1px solid #fad2cf" } }
};

export default function PlanPane({ plan }: { plan: Plan }) {
  const diffKey = plan.difficulty || "Intermediate";
  const diff = diffConfig[diffKey] || diffConfig.Intermediate;

  return (
    <div className="grid-gap-16">
      <header className="lc-section pad-b-10">
        <div className="plan-header">
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap", marginBottom: "6px" }}>
              <div className="plan-title" style={{ margin: 0 }}>{plan.topic || "Öğrenme Planı"}</div>
              {plan.difficulty && (
                <span style={{ ...diff.style, fontSize: "12px", fontWeight: "600", padding: "4px 10px", borderRadius: "99px" }}>
                  {diff.label}
                </span>
              )}
            </div>
            <div className="plan-meta">
              {plan.duration_weeks ? `${plan.duration_weeks} hafta` : "Süre: belirtilmedi"}
              {plan.key_concepts?.length ? ` • ${plan.key_concepts.length} ana kavram` : ""}
            </div>
          </div>
        </div>

        {/* Anahtar Kavramlar (Çökme Korumalı) */}
        {plan.key_concepts?.length ? (
          <div className="lc-chipset">
            {plan.key_concepts.slice(0, 18).map((k, i) => {
              // Gelen veri obje ise string'e çevir veya title'ını al
              const label = typeof k === "object" ? (k as any).title || JSON.stringify(k) : k;
              return <div key={i} className="lc-chip">{label}</div>;
            })}
          </div>
        ) : null}
      </header>
      {plan.learning_outcomes?.length ? (
  <section className="lc-section">
    <h3 className="h3 mb-2">🎯 Learning Outcomes (Syllabus)</h3>
    <ul className="ul">
      {plan.learning_outcomes.map((lo, i) => (
        <li key={i} className="mb-1">
          <strong>{lo.code || `LO${i + 1}`}:</strong> {lo.description}
          {typeof lo.covered === "boolean" && (
            <span
              style={{
                marginLeft: "6px",
                padding: "2px 8px",
                borderRadius: "999px",
                fontSize: "11px",
                fontWeight: 600,
                backgroundColor: lo.covered ? "#e6f4ea" : "#fce8e6",
                color: lo.covered ? "#137333" : "#c5221f",
              }}
            >
              {lo.covered ? "Covered" : "Not fully covered"}
            </span>
          )}

          {/* 👇 Hangi dersler bu LO'yu kapsıyor? */}
          {lo.covered_by_lessons?.length ? (
            <div style={{ marginTop: "4px", fontSize: "12px", opacity: 0.8 }}>
              Lessons:&nbsp;
              {lo.covered_by_lessons.join(", ")}
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  </section>
) : null}


     {(plan.modules || []).map((m, idx) => (
  <ModuleAccordion
    key={idx}
    index={idx}
    mod={m}
    defaultOpen={idx === 0}
    learningOutcomes={plan.learning_outcomes || []}   // 👈 YENİ
  />
))}

      {/* Kaynaklar (Çökme Korumalı - Sorunun Kaynağı Burasıydı) */}
      {plan.resources?.length ? (
        <section className="lc-section">
          <div className="resources-title">Kaynak Önerileri</div>
          <ul className="ul">
            {plan.resources.map((r, i) => {
              let content;
              if (typeof r === "string") {
                content = r;
              } else if (typeof r === "object" && r !== null) {
                // Eğer { title: "...", url: "..." } geldiyse
                content = (
                  <span>
                    {(r as any).title} 
                    {(r as any).url && <a href={(r as any).url} target="_blank" rel="noreferrer" style={{marginLeft: "6px", color: "blue"}}>(Link)</a>}
                  </span>
                );
              } else {
                content = JSON.stringify(r);
              }
              return <li key={i}>{content}</li>;
            })}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function ModuleAccordion({
  mod,
  index,
  defaultOpen = false,
  learningOutcomes = [],
}: {
  mod: ModuleT;
  index: number;
  defaultOpen?: boolean;
  learningOutcomes?: LearningOutcome[];
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="lc-acc">
      <div className="lc-acc-head" onClick={() => setOpen((o) => !o)}>
        <div>
          <div className="lc-acc-title">
            {index + 1}. {mod.title}
          </div>
          <div className="lc-acc-sub">{mod.goal}</div>
        </div>
        <div className="op-50 fw-700" style={{ fontSize: "18px" }}>
          {open ? "−" : "+"}
        </div>
      </div>

      {open && (
        <div className="lc-acc-body">
          <div className="lc-lesson-grid">
            {mod.lessons?.map((l, li) => {
              // 🔗 Bu lesson'ı hangi LO'lar kapsıyor?
              const loTags =
                learningOutcomes
                  ?.filter(
                    (lo) =>
                      lo.covered_by_lessons &&
                      lo.covered_by_lessons.some(
                        (name) =>
                          name.toLowerCase().trim() ===
                          String(l.title).toLowerCase().trim()
                      )
                  )
                  .map((lo) => lo.code)
                  .filter(Boolean) || [];

              return (
                <div key={li} className="lc-lesson">
                  <div className="lc-lesson-head">
                    <div className="fw-800">{l.title}</div>
                    <div className="lc-badge">
                      {prettyMinutes(l.study_time_min)}
                    </div>
                  </div>

                  {/* 🎯 LO etiketleri */}
                  {loTags.length > 0 && (
                    <div style={{ marginTop: "4px", marginBottom: "4px" }}>
                      {loTags.map((code) => (
                        <span
                          key={code}
                          style={{
                            display: "inline-block",
                            marginRight: "4px",
                            marginTop: "2px",
                            padding: "2px 6px",
                            borderRadius: "999px",
                            fontSize: "11px",
                            fontWeight: 600,
                            backgroundColor: "#eef2ff",
                            color: "#3730a3",
                          }}
                        >
                          {code}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="lc-obj">{l.objective}</div>

                  <ul className="list">
                    {l.activities?.map((a, ai) => (
                      <li key={ai} className="list-item">
                        <span
                          className="act-type"
                          style={{ textTransform: "capitalize" }}
                        >
                          {a.type}
                        </span>
                        <span className="op-75"> — {a.prompt}</span>
                      </li>
                    ))}
                  </ul>

                  {l.mini_quiz?.length ? (
                    <div className="quiz-box">
                      <div className="quiz-title">Mini Quiz</div>
                      <ol className="ol">
                        {l.mini_quiz.map((q, qi) => {
                          const qText =
                            typeof q === "object"
                              ? (q as any).question || JSON.stringify(q)
                              : q;
                          return <li key={qi}>{qText}</li>;
                        })}
                      </ol>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
