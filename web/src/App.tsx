import React, { useEffect, useMemo, useState } from "react";

/** -------- Types -------- */
type Activity = { type: string; prompt: string; expected_outcome?: string };
type Lesson = {
  title: string;
  objective: string;
  study_time_min: number;
  activities: Activity[];
  mini_quiz?: string[];
};
type ModuleT = { title: string; goal: string; lessons: Lesson[] };
type Emphasis = {
  statement: string;
  why: string;
  in_slides: boolean;
  evidence: string;
  confidence: number; // 0..1
};
type Plan = {
  topic?: string;
  key_concepts?: string[];
  duration_weeks?: number;
  modules?: ModuleT[];
  resources?: string[];
  emphases?: Emphasis[];
  seed_quiz?: string[];
};

/** -------- Config -------- */
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:4000";

/** -------- Helpers -------- */
function prettyMinutes(min?: number) {
  if (!min && min !== 0) return "";
  if (min < 60) return `${min} dk`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}s ${m} dk` : `${h}s`;
}

/** -------- Modes -------- */
type ModeId = "plan" | "lecturer-note" | "quiz" | "deep-dive" | "exam-sprint";

function getInitialMode(): ModeId {
  const sp = new URLSearchParams(window.location.search);
  const q = sp.get("mode") as ModeId | null;
  const saved = localStorage.getItem("lc.mode") as ModeId | null;
  if (q) return q;
  if (saved) return saved;
  return "plan";
}

/** -------- Main -------- */
export default function App() {
  const [lectureText, setLectureText] = useState("");
  const [slidesText, setSlidesText] = useState("");
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [mode, setMode] = useState<ModeId>(getInitialMode());
  const [quiz, setQuiz] = useState<string[]>([]); // sayfada gösterilecek quiz

  const canSubmit = useMemo(
    () => !loading && lectureText.trim().length > 0 && slidesText.trim().length > 0,
    [loading, lectureText, slidesText]
  );

  // ---- Global UX Styles + Layout (aynen)
  const uxFix = `
    html,body,#root{ background:#f5f5f7; }
    .lc-container{ max-width:1360px; margin:0 auto; padding:0 16px 32px; }
    .lc-shell{ display:grid; gap:16px; }
    @media (min-width:1200px){ .lc-shell{ grid-template-columns: 420px 1fr; align-items:start; } }
    .lc-sticky{ position:sticky; top:72px; }
    .lc-plan-pane{ min-width:0; max-height: calc(100dvh - 72px - 120px); overflow:auto; padding-right:4px; }
    .lc-plan-pane::-webkit-scrollbar{ width:10px; } .lc-plan-pane::-webkit-scrollbar-thumb{ background:#d1d1d6; border-radius:8px; }
    .lc-textarea{ background:#fbfbfd; border:1px solid #d1d1d6; color:#111; border-radius:16px; padding:12px; outline:none; box-shadow: inset 0 1px 0 rgba(0,0,0,.02); transition:.15s; font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text",Inter,system-ui; }
    .lc-textarea::placeholder{ color:#8e8e93; } .lc-textarea:focus{ background:#fff; border-color:#007aff; box-shadow: 0 0 0 4px rgba(0,122,255,.12), inset 0 1px 0 rgba(0,0,0,.02); }
    .lc-acc{ background:#fff; border:1px solid #e5e5ea; border-radius:16px; box-shadow: 0 6px 18px rgba(0,0,0,.03); overflow:hidden; }
    .lc-acc-head{ display:flex; align-items:center; justify-content:space-between; padding:14px 16px; cursor:pointer; }
    .lc-acc-title{ font-weight:800; font-size:18px; } .lc-acc-sub{ opacity:.6; font-size:13px; } .lc-acc-body{ padding:10px 12px 14px; border-top:1px dashed #eee; }
    .lc-lesson-grid{ display:grid; gap:12px; grid-template-columns: 1fr; }
    @media (min-width:900px){ .lc-lesson-grid{ grid-template-columns: repeat(2, minmax(260px, 1fr)); } }
    @media (min-width:1400px){ .lc-lesson-grid{ grid-template-columns: repeat(2, minmax(320px, 1fr)); } }
    .lc-lesson{ border:1px solid #efeff4; border-radius:14px; background:#fff; padding:12px; }
    .lc-lesson-head{ display:flex; justify-content:space-between; align-items:center; gap:10px; margin-bottom:6px; }
    .lc-badge{ background:#111; color:#fff; border-radius:999px; font-size:12px; padding:4px 10px; line-height:1.2; }
    .lc-obj{ opacity:.85; margin:2px 0 6px; display:-webkit-box; -webkit-box-orient:vertical; -webkit-line-clamp:3; overflow:hidden; }
    .lc-chipset{display:flex; flex-wrap:wrap; gap:8px; margin:8px 0 14px;}
    .lc-chip{ border:1px solid #e5e5ea; background:#fff; border-radius:999px; padding:6px 10px; font-size:13px; }
    .lc-section{ background:#fff; border:1px solid #e5e5ea; border-radius:20px; padding:16px; box-shadow:0 6px 18px rgba(0,0,0,.03); }
    .quiz-list li{ margin: 6px 0; }
    .emphasis-row{ display:grid; grid-template-columns: 1fr auto auto; gap:8px; align-items:center; }
    .pill{ padding:3px 8px; border:1px solid #e5e5ea; border-radius:999px; font-size:12px; }
  `;

  // URL & localStorage senkronu
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("mode", mode);
    window.history.replaceState({}, "", url.toString());
    localStorage.setItem("lc.mode", mode);
  }, [mode]);

  // Kısayollar: 1..5
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest("input,textarea,[contenteditable=true]")) return;
      const map: Record<string, ModeId> = { "1": "plan", "2": "lecturer-note", "3": "quiz", "4": "deep-dive", "5": "exam-sprint" };
      if (map[e.key]) setMode(map[e.key]);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setErr(null);
    setPlan(null);
    setQuiz([]);

    try {
      const r = await fetch(`${API_BASE}/api/plan-from-text`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lectureText, slidesText }),
      });

      const txt = await r.text();
      let j: any = null;
      try { j = JSON.parse(txt); } catch {}
      if (!r.ok) throw new Error(j?.error || txt || "Sunucu hatası");
      if (!j?.ok) throw new Error(j?.error || "Plan üretilemedi");

      const p = j.plan as Plan;
      setPlan(p);
      // plan ile gelen seed_quiz varsa quiz paneline koy
      if (p.seed_quiz?.length) setQuiz(p.seed_quiz.slice(0, 12));
      setMode("plan"); // üretimden sonra Plan sekmesine geç
    } catch (e: any) {
      setErr(e?.message || "İstek hatası");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={st.page}>
      <style dangerouslySetInnerHTML={{ __html: uxFix }} />

      {/* Navbar */}
      <div style={st.nav}>
        <div style={st.brand}>
          <div style={st.brandDot} />
          <span style={st.brandText}>LearnCraft</span>
        </div>
        <div style={{ flex: 1 }} />
        <div style={st.pill}>Planlar</div>
        <div style={st.pill}>İçgörüler</div>
      </div>

      <div className="lc-container">
        {/* Hero */}
        <header style={st.hero}>
          <h1 style={st.h1}>Öğretmen Metni + Slayttan Öğrenme Yolu</h1>
          <p style={st.sub}>
            Hocanın konuşması ve slayt metnini gir. Yapay zekâ, sade ve uygulanabilir bir plan üretsin.
          </p>
        </header>

        <div className="lc-shell">
          {/* Sol: Sticky Form */}
          <div className="lc-sticky">
            <form style={st.card} onSubmit={handleSubmit}>
              <label style={st.label}>Hocanın Metni</label>
              <textarea
                className="lc-textarea"
                value={lectureText}
                onChange={(e) => setLectureText(e.target.value)}
                placeholder="LEC: ders konuşma metni buraya..."
                rows={8}
                style={st.textarea}
              />

              <label style={st.label}>Slayt Metni</label>
              <textarea
                className="lc-textarea"
                value={slidesText}
                onChange={(e) => setSlidesText(e.target.value)}
                placeholder="SLIDE: slayt sayfalarının metni buraya..."
                rows={8}
                style={st.textarea}
              />

              <div style={st.actions}>
                <button
                  type="submit"
                  disabled={!canSubmit}
                  style={canSubmit ? st.button : st.buttonDisabled}
                >
                  {loading ? "Üretiliyor…" : "Öğrenme Yolunu Oluştur"}
                </button>
                {err && <span style={st.error}>❌ {err}</span>}
              </div>
            </form>
          </div>

          {/* Sağ: Modlu Panel */}
          <div className="lc-plan-pane">
            <ModeRibbon mode={mode} setMode={setMode} />

            {mode === "plan" && (
              plan ? (
                <PlanPane plan={plan} />
              ) : (
                <div className="lc-section" style={{ opacity: 0.6 }}>
                  Henüz plan yok. Soldaki metinlerle bir plan üretin.
                </div>
              )
            )}

            {mode === "lecturer-note" && (
              <LecturerNotePane
                lectureText={lectureText}
                slidesText={slidesText}
                emphases={plan?.emphases || []}
              />
            )}

            {mode === "quiz" && (
              <QuizPane
                quiz={quiz}
                setQuiz={setQuiz}
                hasPlan={!!plan}
                plan={plan}
              />
            )}

            {mode === "deep-dive" && <DeepDivePane />}

            {mode === "exam-sprint" && <ExamSprintPane />}
          </div>
        </div>

        <footer style={st.footer}>© {new Date().getFullYear()} LearnCraft</footer>
      </div>
    </div>
  );
}

/** -------- Mode Ribbon -------- */
function ModeRibbon({ mode, setMode }: { mode: ModeId; setMode: (m: ModeId) => void }) {
  const tabs: { id: ModeId; label: string }[] = [
    { id: "plan", label: "Plan" },
    { id: "lecturer-note", label: "Hoca Notu" },
    { id: "quiz", label: "Quiz" },
    { id: "deep-dive", label: "Derinleşme" },
    { id: "exam-sprint", label: "Sprint" },
  ];
  return (
    <div
      style={{
        position: "sticky", top: 0, zIndex: 5,
        background: "rgba(245,245,247,0.85)", backdropFilter: "blur(8px)",
        padding: "8px 0", marginBottom: 8, borderBottom: "1px solid #e5e5ea",
      }}
    >
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setMode(t.id)}
            style={{
              padding: "6px 12px",
              borderRadius: 999,
              border: "1px solid #e5e5ea",
              background: mode === t.id ? "#111" : "#fff",
              color: mode === t.id ? "#fff" : "#111",
              fontWeight: 800, fontSize: 13,
            }}
            title={`Kısayol: ${["plan","lecturer-note","quiz","deep-dive","exam-sprint"].indexOf(t.id)+1}`}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** -------- Right Pane: Plan -------- */
function PlanPane({ plan }: { plan: Plan }) {
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <header className="lc-section" style={{ paddingBottom: 10 }}>
        <div style={st.planHeader}>
          <div>
            <div style={st.planTitle}>{plan.topic || "Öğrenme Planı"}</div>
            <div style={st.planMeta}>
              {plan.duration_weeks ? `${plan.duration_weeks} hafta` : "Süre: belirtilmedi"}
              {plan.key_concepts?.length ? ` • ${plan.key_concepts.length} ana kavram` : ""}
            </div>
          </div>
        </div>

        {plan.key_concepts?.length ? (
          <div className="lc-chipset">
            {plan.key_concepts.slice(0, 18).map((k, i) => (
              <div key={i} className="lc-chip">{k}</div>
            ))}
          </div>
        ) : null}
      </header>

      {(plan.modules || []).map((m, idx) => (
        <ModuleAccordion key={idx} index={idx} mod={m} defaultOpen={idx === 0} />
      ))}

      {plan.resources?.length ? (
        <section className="lc-section">
          <div style={st.resourcesTitle}>Kaynak Önerileri</div>
          <ul style={st.ul}>{plan.resources.map((r, i) => (<li key={i}>{r}</li>))}</ul>
        </section>
      ) : null}
    </div>
  );
}

function ModuleAccordion({
  mod, index, defaultOpen = false,
}: { mod: ModuleT; index: number; defaultOpen?: boolean; }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="lc-acc">
      <div className="lc-acc-head" onClick={() => setOpen((o) => !o)}>
        <div>
          <div className="lc-acc-title">{index + 1}. {mod.title}</div>
          <div className="lc-acc-sub">{mod.goal}</div>
        </div>
        <div style={{ opacity: 0.5, fontWeight: 700 }}>{open ? "−" : "+"}</div>
      </div>
      {open && (
        <div className="lc-acc-body">
          <div className="lc-lesson-grid">
            {mod.lessons?.map((l, li) => (
              <div key={li} className="lc-lesson">
                <div className="lc-lesson-head">
                  <div style={{ fontWeight: 800 }}>{l.title}</div>
                  <div className="lc-badge">{prettyMinutes(l.study_time_min)}</div>
                </div>
                <div className="lc-obj">{l.objective}</div>
                <ul style={st.list}>
                  {l.activities?.map((a, ai) => (
                    <li key={ai} style={st.listItem}>
                      <span style={st.actType}>{a.type}</span><span> — {a.prompt}</span>
                    </li>
                  ))}
                </ul>
                {l.mini_quiz?.length ? (
                  <div style={st.quizBox}>
                    <div style={st.quizTitle}>Mini Quiz</div>
                    <ol style={st.ol}>{l.mini_quiz.map((q, qi) => (<li key={qi}>{q}</li>))}</ol>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

/** -------- Lecturer Note (auto-emphasis) -------- */
function LecturerNotePane({
  lectureText, slidesText, emphases,
}: { lectureText: string; slidesText: string; emphases: Emphasis[] }) {
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <Section title="Hoca burada çok değindi (slaytta yok)">
        <div style={{ opacity: 0.75, fontSize: 13 }}>
          Aşağıda otomatik çıkarılan vurgular var. Düzenleyip görev oluşturabilirsin.
        </div>

        {/* Otomatik tespit listesi */}
        <div className="lc-section" style={{ display:"grid", gap:10 }}>
          {emphases?.length ? emphases.map((e, i) => (
            <div key={i} className="emphasis-row">
              <div>
                <div style={{ fontWeight: 700 }}>{e.statement}</div>
                <div style={{ opacity:.75, fontSize:13 }}>{e.why}</div>
                <div style={{ opacity:.6, fontSize:12 }}>Kanıt: {e.evidence || "—"}</div>
              </div>
              <span className="pill">{e.in_slides ? "Slaytta var" : "Slaytta yok"}</span>
              <span className="pill">%{Math.round((e.confidence ?? 0) * 100)}</span>
            </div>
          )) : <div style={{ opacity:.65 }}>Henüz vurgu çıkarımı yok. Plan ürettikten sonra burada listelenir.</div>}
        </div>

        {/* Manuel not alanları */}
        <div style={{ display: "grid", gap: 8 }}>
          <input className="lc-textarea" placeholder="Konu/Başlık" style={{ minHeight: 44 }} />
          <textarea className="lc-textarea" placeholder="Neden önemli? (Sınavda kısa cevap olabilir...)" rows={4} />
          <textarea className="lc-textarea" placeholder="Kaynak/kanıt: Kitap s. 142, ders dakikası 18:35..." rows={3} />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button style={st.button}>Kaydet</button>
            <button style={st.button}>Görev Oluştur</button>
          </div>
        </div>

        {/* Kaynak önizleme */}
        <div style={{ fontSize: 12, opacity: 0.5 }}>Girdilerinden örnekler (salt okuma):</div>
        <pre className="lc-textarea" style={{ whiteSpace: "pre-wrap", minHeight: 80 }}>
          {lectureText.slice(0, 400) || "LEC boş"}
        </pre>
        <pre className="lc-textarea" style={{ whiteSpace: "pre-wrap", minHeight: 80 }}>
          {slidesText.slice(0, 400) || "SLIDE boş"}
        </pre>
      </Section>
    </div>
  );
}

/** -------- Quiz (page render, no alert) -------- */
function QuizPane({
  quiz, setQuiz, hasPlan, plan,
}: { quiz: string[]; setQuiz: (q: string[]) => void; hasPlan: boolean; plan: Plan | null }) {
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <Section title="Quiz Modu">
        <div className="lc-chipset">
          <div className="lc-chip">Süre: 15–20 dk</div>
          <div className="lc-chip">Yanlışlara mini tekrar</div>
          <div className="lc-chip">Karışık konu puanı</div>
        </div>

        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          <button
            style={!hasPlan ? st.buttonDisabled : st.button}
            disabled={!hasPlan}
            onClick={async () => {
              try {
                // İstersen sadece plan.seed_quiz'i kullan; fakat burada opsiyonel rota ile yeniliyoruz
                const r = await fetch(`${API_BASE}/api/quiz-from-plan`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ plan }),
                });
                const j = await r.json();
                if (j.ok) setQuiz(j.questions);
                else alert(j.error || "Üretilemedi");
              } catch (e: any) {
                alert(e?.message || "İstek hatası");
              }
            }}
          >
            10 Soru Üret / Yenile
          </button>

          <button
            style={quiz.length ? st.button : st.buttonDisabled}
            disabled={!quiz.length}
            onClick={() => {
              navigator.clipboard?.writeText(quiz.map((q, i) => `${i + 1}. ${q}`).join("\n"));
            }}
          >
            Kopyala
          </button>

          {!hasPlan && <span style={{ fontSize: 12, opacity: 0.7 }}>Önce “Plan” üret.</span>}
        </div>

        <div className="lc-section" style={{ paddingTop: 8 }}>
          {quiz.length ? (
            <ol className="quiz-list" style={{ paddingLeft: 18 }}>
              {quiz.map((q, i) => <li key={i}>{q}</li>)}
            </ol>
          ) : (
            <div style={{ opacity: 0.65 }}>Henüz soru yok. “10 Soru Üret / Yenile”ye tıkla veya plan üretiminden gelen seed sorular otomatik görünür.</div>
          )}
        </div>
      </Section>
    </div>
  );
}

/** -------- DeepDive / ExamSprint (aynı) -------- */
function DeepDivePane() {
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <Section title="Derinleşme (Boşluk Analizi)">
        <textarea className="lc-textarea" placeholder="Eksiğim ne? (Örn: QQ plot yorumu, Ki-kare p-değeri...)" rows={4} />
        <input className="lc-textarea" placeholder="Kaynak/Link/Sayfa (Slide 21-33, kitap 98-105...)" style={{ minHeight: 44 }} />
        <div style={{ display: "flex", gap: 8 }}>
          <input className="lc-textarea" placeholder="Son tarih (YYYY-AA-GG)" style={{ minHeight: 44, maxWidth: 220 }} />
          <button style={st.button}>Okuma Listesi Üret</button>
        </div>
        <div style={{ fontSize: 12, opacity: 0.6 }}>Her boşluk için ölçülebilir çıktı: “3 örnek soru yorumladım” gibi.</div>
      </Section>
    </div>
  );
}

function ExamSprintPane() {
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <Section title="Sınav Sprinti">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input className="lc-textarea" placeholder="Gün sayısı (7–14)" style={{ minHeight: 44, maxWidth: 160 }} />
          <button
            style={st.button}
            onClick={async () => {
              try {
                const r = await fetch(`${API_BASE}/api/sprint-schedule`, { method: "POST" });
                const j = await r.json();
                alert(j.ok ? j.schedule?.slice(0,7).join("\n") : j.error || "Üretilemedi");
              } catch (e: any) {
                alert(e?.message || "İstek hatası");
              }
            }}
          >
            7 Günlük Takvim Öner
          </button>
        </div>
        <div className="lc-chipset">
          <div className="lc-chip">Pomodoro 40–10</div>
          <div className="lc-chip">Son 48 saat: hafif tekrar</div>
          <div className="lc-chip">Yanlışlar listesi</div>
        </div>
      </Section>
    </div>
  );
}

/** -------- Utilities -------- */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="lc-section" style={{ display: "grid", gap: 12 }}>
      <div style={{ fontWeight: 800, fontSize: 18 }}>{title}</div>
      {children}
    </section>
  );
}

/** -------- Styles -------- */
const st: Record<string, React.CSSProperties> = {
  page: { background: "#f5f5f7", color: "#0b0b0c", minHeight: "100dvh", fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", Inter, system-ui, Segoe UI, Roboto, Helvetica, Arial' },
  nav: { display: "flex", alignItems: "center", gap: 12, padding: "14px 20px", position: "sticky", top: 0, backdropFilter: "saturate(180%) blur(16px)", background: "rgba(255,255,255,0.65)", borderBottom: "1px solid #e5e5ea", zIndex: 10 },
  brand: { display: "flex", alignItems: "center", gap: 8 },
  brandDot: { width: 12, height: 12, borderRadius: 18, background: "#111", boxShadow: "0 0 0 3px #999 inset" },
  brandText: { fontWeight: 800, letterSpacing: 0.2 },
  pill: { padding: "6px 12px", borderRadius: 999, border: "1px solid #e5e5ea", background: "#fff", fontSize: 13 },
  hero: { margin: "40px 0 14px" },
  h1: { fontSize: 34, fontWeight: 800, letterSpacing: -0.3, margin: 0 },
  sub: { opacity: 0.7, marginTop: 8, marginBottom: 0 },
  card: { padding: 16, background: "#fff", border: "1px solid #e5e5ea", borderRadius: 24, boxShadow: "0 10px 30px rgba(0,0,0,.04)" },
  label: { fontWeight: 700, marginTop: 6, marginBottom: 6, display: "block" },
  textarea: { width: "100%", resize: "vertical", minHeight: 140 },
  actions: { display: "flex", alignItems: "center", gap: 12, marginTop: 14, flexWrap: "wrap" },
  button: { background: "#111", color: "#fff", border: "1px solid #111", padding: "10px 16px", borderRadius: 12, cursor: "pointer", fontWeight: 800 },
  buttonDisabled: { background: "#c7c7cc", color: "#fff", border: "1px solid #c7c7cc", padding: "10px 16px", borderRadius: 12, cursor: "not-allowed", fontWeight: 800 },
  error: { color: "#c62828", fontWeight: 600 },
  planHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  planTitle: { fontSize: 26, fontWeight: 800, letterSpacing: -0.2 },
  planMeta: { opacity: 0.6 },
  list: { margin: 0, paddingLeft: 18 },
  listItem: { margin: "4px 0" },
  actType: { fontWeight: 800 },
  quizBox: { background: "#fafafa", border: "1px solid #efeff4", borderRadius: 14, padding: 10, marginTop: 6 },
  quizTitle: { fontWeight: 800, marginBottom: 6 },
  resourcesTitle: { fontWeight: 800, marginBottom: 8 },
  ul: { paddingLeft: 18, margin: 0 },
  ol: { paddingLeft: 18, margin: 0 },
  footer: { textAlign: "center", opacity: 0.5, padding: "24px 0" },
};
