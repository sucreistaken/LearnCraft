import React, { useEffect, useMemo, useState } from "react";
import "./App.css";
import { generateQuiz, submitQuiz } from "./lib/api"; // opsiyonel
import LessonsHistoryPane from "./components/LessonsHistoryPane";

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
type AlignItem = {
  topic: string;
  concepts: string[];
  in_both: boolean;
  emphasis_level: "high" | "medium" | "low";
  lecture_quotes: string[];
  slide_refs: string[];
  duration_min: number;
  confidence: number;
};
type Alignment = {
  summary_chatty?: string;
  average_duration_min?: number;
  items?: AlignItem[];
};

type Plan = {
  topic?: string;
  key_concepts?: string[];
  duration_weeks?: number;
  modules?: ModuleT[];
  resources?: string[];
  emphases?: Emphasis[];
  seed_quiz?: string[];
  alignment?: Alignment;
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
type ModeId =
  | "plan"
  | "alignment"
  | "lecturer-note"
  | "quiz"
  | "deep-dive"
  | "exam-sprint"
  | "history";

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
  const [quiz, setQuiz] = useState<string[]>([]);

  // 🔹 Ders listesi & seçim
  const [lessons, setLessons] = useState<
    Array<{ id: string; title: string; createdAt?: string; progress?: { percent?: number; lastMode?: string } }>
  >([]);
  const [currentLessonId, setCurrentLessonId] = useState<string | null>(
    localStorage.getItem("lc.lastLessonId")
  );

  // 🔹 Yeni Ders Modal state
  const [showNewLessonModal, setShowNewLessonModal] = useState(false);
  const [newLessonTitle, setNewLessonTitle] = useState("");
  const [draftTitle, setDraftTitle] = useState<string>(""); // isim alındı ama id yoksa
  const [lastSelectedLessonId, setLastSelectedLessonId] = useState<string | null>(null);

  const canSubmit = useMemo(
    () => !loading && lectureText.trim().length > 0 && slidesText.trim().length > 0,
    [loading, lectureText, slidesText]
  );

  // URL & localStorage senkronu
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("mode", mode);
    window.history.replaceState({}, "", url.toString());
    localStorage.setItem("lc.mode", mode);
  }, [mode]);

  // Kısayollar: 1..7
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest("input,textarea,[contenteditable=true]")) return;
      const map: Record<string, ModeId> = {
        "1": "plan",
        "2": "alignment",
        "3": "lecturer-note",
        "4": "quiz",
        "5": "deep-dive",
        "6": "exam-sprint",
        "7": "history",
      };
      if (map[e.key]) setMode(map[e.key]);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // 🔹 Dersleri yükle
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${API_BASE}/api/lessons`);
        const j = await r.json();
        if (Array.isArray(j)) setLessons(j);
        // hiç ders yoksa seçiciden "Yeni Ders" açıldığında modal gelsin
      } catch (err) {
        console.warn("ders listesi alınamadı:", err);
      }
    })();
  }, []);

  // 🔹 Bir ders seçilince formu doldur
  useEffect(() => {
    if (!currentLessonId) return;
    (async () => {
      try {
        const r = await fetch(`${API_BASE}/api/lessons/${currentLessonId}`);
        if (!r.ok) return;
        const l = await r.json();
        if (typeof l?.transcript === "string") setLectureText(l.transcript);
        if (typeof l?.slideText === "string") setSlidesText(l.slideText);
        if (l?.plan) setPlan(l.plan);
      } catch (e) {
        console.warn("ders detayı çekilemedi:", e);
      }
    })();
  }, [currentLessonId]);

  // Taslak modunda formu temiz tut (güvence)
  useEffect(() => {
    if (!currentLessonId && draftTitle) {
      setLectureText("");
      setSlidesText("");
      setPlan(null);
      setQuiz([]);
    }
  }, [currentLessonId, draftTitle]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setLoading(true);
    setErr(null);
    setPlan(null);
    setQuiz([]);

    try {
      const titleGuess =
        draftTitle || (plan as any)?.topic || `Lecture ${new Date().toLocaleDateString()}`;

      const r = await fetch(`${API_BASE}/api/plan-from-text`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lectureText,
          slidesText,
          title: titleGuess,
          lessonId: currentLessonId ?? undefined,
        }),
      });

      const j = await r.json().catch(() => null);

      if (!r.ok || !j?.ok) {
        throw new Error(j?.error || "Sunucu hatası");
      }

      if (j.lessonId) {
        const isNewlyCreated = !currentLessonId;
        setCurrentLessonId(j.lessonId);
        localStorage.setItem("lc.lastLessonId", j.lessonId);

        // Listeyi anında senkronla
        setLessons((ls) => {
          const exists = ls.some((x) => x.id === j.lessonId);
          if (exists) {
            return ls.map((x) => (x.id === j.lessonId ? { ...x, title: titleGuess } : x));
          } else if (isNewlyCreated) {
            return [{ id: j.lessonId, title: titleGuess, date: new Date().toISOString() }, ...ls];
          }
          return ls;
        });

        setDraftTitle(""); // taslak bitti
      }

      const p = j.plan as Plan;
      setPlan(p);
      if (p?.seed_quiz?.length) setQuiz(p.seed_quiz.slice(0, 12));

      setMode("alignment");
    } catch (e: any) {
      setErr(e?.message || "İstek hatası");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page">
      {/* Navbar */}
      <div className="nav">
        <div className="brand">
          <div className="brand-dot" />
          <span className="brand-text">LearnCraft</span>
        </div>
        <div className="flex-1" />
        <div className="pill">Planlar</div>
        <div className="pill">İçgörüler</div>
      </div>

      <div className="lc-container">
        {/* Hero */}
        <header className="hero">
          <h1 className="h1">Öğretmen Metni + Slayt Eşleştirme & Vurgular</h1>
          <p className="sub">Konuşma ve PDF içeriğini karşılaştır; vurguları ve süreleri beraber görelim.</p>
        </header>

        <div className="lc-shell">
          {/* Sol: Sticky Form */}
          <div className="lc-sticky">
            <form className="card" onSubmit={handleSubmit}>
              {/* Ders Seçici */}
              <label className="label">Ders Seç</label>
              <select
                className="lc-select"
                value={currentLessonId ?? "__none__"}
                onChange={(e) => {
                  const val = e.target.value;
                  setLastSelectedLessonId(currentLessonId);

                  if (val === "__new__") {
                    // Yeni ders akışı → modal
                    setNewLessonTitle("");
                    setShowNewLessonModal(true);
                    return;
                  }
                  if (val === "__none__") {
                    setCurrentLessonId(null);
                    localStorage.removeItem("lc.lastLessonId");
                    return;
                  }
                  // Mevcut derse geçiş
                  setCurrentLessonId(val);
                  localStorage.setItem("lc.lastLessonId", val);
                }}
              >
                <option value="__new__">➕ Yeni Ders Oluştur</option>
                {/* görünmez no-selection durumu (controlled select için) */}
                <option value="__none__" style={{ display: "none" }}>—</option>
                {/* Taslak varsa (modalda isim alındı ama id yok) kullanıcı görsün */}
                {draftTitle ? (
                  <option value="__none__">📝 Taslak: {draftTitle}</option>
                ) : null}
                {lessons.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.title}
                    {typeof l?.progress?.percent === "number"
                      ? ` • %${Math.round(l.progress.percent)}`
                      : ""}
                  </option>
                ))}
              </select>

              <label className="label">Hocanın Konuşma Metni</label>
              <textarea
                className="lc-textarea textarea"
                value={lectureText}
                onChange={(e) => setLectureText(e.target.value)}
                placeholder="LEC: ders konuşma metni buraya..."
                rows={8}
              />

              <label className="label">PDF/Slayt Metni</label>
              <textarea
                className="lc-textarea textarea"
                value={slidesText}
                onChange={(e) => setSlidesText(e.target.value)}
                placeholder="SLIDE: PDF'ten alınmış metin (başlıklar, maddeler...)"
                rows={8}
              />

              <div className="actions">
                <button
                  type="submit"
                  disabled={!canSubmit}
                  className={canSubmit ? "btn" : "btn btn--disabled"}
                >
                  {loading ? "Analiz ediliyor…" : "Plan + Eşleştirme Oluştur"}
                </button>
                {err && <span className="error">❌ {err}</span>}
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
                <div className="lc-section muted-block">
                  Henüz plan yok. Soldaki metinlerle bir plan üretin.
                </div>
              )
            )}

            {mode === "alignment" && (
              plan ? (
                <AlignmentPane plan={plan} />
              ) : (
                <div className="lc-section muted-block">
                  Henüz eşleştirme yok. Soldan üret.
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
                lectureText={lectureText}
                slidesText={slidesText}
              />
            )}

            {mode === "history" && (
              <LessonsHistoryPane
                setMode={setMode}
                setQuiz={setQuiz}
                onSelectLesson={(id: string) => {
                  // 🔹 Geçmişten derse tıklanınca App’e bildir → dersi yükle & Plan moduna geç
                  setCurrentLessonId(id);
                  localStorage.setItem("lc.lastLessonId", id);
                  setMode("plan");
                }}
              />
            )}

            {mode === "deep-dive" && <DeepDivePane />}
            {mode === "exam-sprint" && <ExamSprintPane />}
          </div>
        </div>

        <footer className="footer">© {new Date().getFullYear()} LearnCraft</footer>
      </div>

      {/* Yeni Ders Modalı */}
      {showNewLessonModal && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal">
            <div className="modal-title">Yeni ders adı nedir?</div>
            <input
              autoFocus
              className="lc-textarea input"
              placeholder="Örn: PHYS 101"
              value={newLessonTitle}
              onChange={(e)=>setNewLessonTitle(e.target.value)}
              onKeyDown={(e)=>{
                if (e.key === "Enter") (document.getElementById("createLessonBtn") as HTMLButtonElement)?.click();
                if (e.key === "Escape") (document.getElementById("cancelLessonBtn") as HTMLButtonElement)?.click();
              }}
            />
            <div className="modal-actions">
              <button
                id="cancelLessonBtn"
                className="btn"
                onClick={()=>{
                  setShowNewLessonModal(false);
                  // iptal → eski derse geri dön
                  const prev = lastSelectedLessonId ?? localStorage.getItem("lc.lastLessonId");
                  if (prev) setCurrentLessonId(prev);
                  else setCurrentLessonId(null);
                }}
              >
                İptal
              </button>
              <button
                id="createLessonBtn"
                className="btn btn-primary"
                onClick={async ()=>{
                  const name = newLessonTitle.trim();
                  if (!name) return;

                  // Formu sıfırla – yeni derse temiz başlangıç
                  setLectureText("");
                  setSlidesText("");
                  setPlan(null);
                  setQuiz([]);
                  setDraftTitle(name);

                  // Backend'de oluşturmayı dene (varsa)
                  let createdId: string | null = null;
                  try {
                    const r = await fetch(`${API_BASE}/api/lessons`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ title: name })
                    });
                    const j = await r.json().catch(()=>null);
                    if (r.ok && j?.id) createdId = j.id;
                  } catch {}

                  if (createdId) {
                    // listeye anında ekle ve seç
                    setLessons(ls => [{ id: createdId!, title: name, date: new Date().toISOString() }, ...ls]);
                    setCurrentLessonId(createdId);
                    localStorage.setItem("lc.lastLessonId", createdId);
                    setDraftTitle("");
                  } else {
                    // henüz id yok → plan üretiminde gelecek
                    setCurrentLessonId(null);
                    localStorage.removeItem("lc.lastLessonId");
                  }

                  setShowNewLessonModal(false);
                }}
              >
                Oluştur
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** -------- Mode Ribbon -------- */
function ModeRibbon({ mode, setMode }: { mode: ModeId; setMode: (m: ModeId) => void }) {
  const tabs: { id: ModeId; label: string }[] = [
    { id: "plan", label: "Plan" },
    { id: "alignment", label: "Eşleştirme & Vurgular" },
    { id: "lecturer-note", label: "Hoca Notu" },
    { id: "quiz", label: "Quiz" },
    { id: "deep-dive", label: "Derinleşme" },
    { id: "exam-sprint", label: "Sprint" },
    { id: "history", label: "Derslerim" },
  ];
  return (
    <div className="mode-ribbon">
      <div className="tabs">
        {tabs.map((t, idx) => (
          <button
            key={t.id}
            onClick={() => setMode(t.id)}
            className={`tab ${mode === t.id ? "tab--active" : ""}`}
            title={`Kısayol: ${idx + 1}`}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** -------- Plan -------- */
function PlanPane({ plan }: { plan: Plan }) {
  return (
    <div className="grid-gap-16">
      <header className="lc-section pad-b-10">
        <div className="plan-header">
          <div>
            <div className="plan-title">{plan.topic || "Öğrenme Planı"}</div>
            <div className="plan-meta">
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
          <div className="resources-title">Kaynak Önerileri</div>
          <ul className="ul">{plan.resources.map((r, i) => (<li key={i}>{r}</li>))}</ul>
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
        <div className="op-50 fw-700">{open ? "−" : "+"}</div>
      </div>
      {open && (
        <div className="lc-acc-body">
          <div className="lc-lesson-grid">
            {mod.lessons?.map((l, li) => (
              <div key={li} className="lc-lesson">
                <div className="lc-lesson-head">
                  <div className="fw-800">{l.title}</div>
                  <div className="lc-badge">{prettyMinutes(l.study_time_min)}</div>
                </div>
                <div className="lc-obj">{l.objective}</div>
                <ul className="list">
                  {l.activities?.map((a, ai) => (
                    <li key={ai} className="list-item">
                      <span className="act-type">{a.type}</span><span> — {a.prompt}</span>
                    </li>
                  ))}
                </ul>
                {l.mini_quiz?.length ? (
                  <div className="quiz-box">
                    <div className="quiz-title">Mini Quiz</div>
                    <ol className="ol">{l.mini_quiz.map((q, qi) => (<li key={qi}>{q}</li>))}</ol>
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

/** -------- Alignment -------- */
function AlignmentPane({ plan }: { plan: Plan }) {
  const a = plan.alignment;
  const avg = a?.average_duration_min ?? average(a?.items?.map(i => i.duration_min) || []);

  return (
    <div className="grid-gap-12">
      <section className="lc-section grid-gap-10">
        <div className="fw-800 fs-18">Eşleştirme Özeti</div>
        {a?.summary_chatty ? (
          <p className="m-0">{a.summary_chatty}</p>
        ) : (
          <p className="m-0 op-70">
            Özet metni bulunamadı. Yine de aşağıdaki tablo eşleşmeleri ve süreleri gösterir.
          </p>
        )}
        <div className="lc-chipset">
          <div className="lc-chip">Ortalama süre: ~{Number.isFinite(avg) ? `${avg.toFixed(1)} dk` : "—"}</div>
        </div>
      </section>

      <section className="lc-section">
        <table className="aligned-table">
          <thead>
            <tr>
              <th>Konu / Kavramlar</th>
              <th>Vurgu</th>
              <th>Kaynaklar</th>
              <th>Süre (dk)</th>
            </tr>
          </thead>
          <tbody>
            {(a?.items || []).map((it, i) => (
              <tr key={i}>
                <td>
                  <div className="fw-700">{it.topic}</div>
                  {!!it.concepts?.length && (
                    <div className="muted"> {it.concepts.join(", ")} </div>
                  )}
                </td>
                <td>
                  <div className="lc-chipset m-0">
                    <span className="pill">{it.in_both ? "Konuşma+Slayt" : "Tek kaynak"}</span>
                    <span className="pill">Emphasis: {it.emphasis_level}</span>
                    <span className="pill">Güven: %{Math.round((it.confidence ?? 0) * 100)}</span>
                  </div>
                </td>
                <td>
                  {it.lecture_quotes?.slice(0, 2).map((q, qi) => (<div key={qi} className="muted">“{q}”</div>))}
                  {it.slide_refs?.slice(0, 2).map((s, si) => (<div key={si} className="muted">• {s}</div>))}
                </td>
                <td className="fw-700">{Number.isFinite(it.duration_min) ? it.duration_min.toFixed(1) : "—"}</td>
              </tr>
            ))}
            {!a?.items?.length && (
              <tr><td colSpan={4} className="muted">Eşleşme bulunamadı.</td></tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function average(ns: number[]) {
  if (!ns.length) return NaN;
  const s = ns.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0);
  const c = ns.filter(n => Number.isFinite(n)).length;
  return c ? s / c : NaN;
}

/** -------- Lecturer Note -------- */
function LecturerNotePane({
  lectureText, slidesText, emphases,
}: { lectureText: string; slidesText: string; emphases: Emphasis[] }) {
  return (
    <div className="grid-gap-12">
      <Section title="Hoca burada çok değindi (slaytta yok)">
        <div className="op-75 fs-13">
          Aşağıda otomatik çıkarılan vurgular var. Düzenleyip görev oluşturabilirsin.
        </div>

        <div className="lc-section grid-gap-10">
          {emphases?.length ? emphases.map((e, i) => (
            <div key={i} className="row-3col">
              <div>
                <div className="fw-700">{e.statement}</div>
                <div className="op-75 fs-13">{e.why}</div>
                <div className="op-60 fs-12">Kanıt: {e.evidence || "—"}</div>
              </div>
              <span className="pill">{e.in_slides ? "Slaytta var" : "Slaytta yok"}</span>
              <span className="pill">%{Math.round((e.confidence ?? 0) * 100)}</span>
            </div>
          )) : <div className="op-65">Henüz vurgu çıkarımı yok. Plan ürettikten sonra burada listelenir.</div>}
        </div>

        <div className="grid-gap-8">
          <input className="lc-textarea input" placeholder="Konu/Başlık" />
          <textarea className="lc-textarea textarea" placeholder="Neden önemli? (Sınavda kısa cevap olabilir...)" rows={4} />
          <textarea className="lc-textarea textarea" placeholder="Kaynak/kanıt: Kitap s. 142, ders dakikası 18:35..." rows={3} />
          <div className="flex-gap-8">
            <button className="btn">Kaydet</button>
            <button className="btn">Görev Oluştur</button>
          </div>
        </div>

        <div className="fs-12 op-50">Girdilerinden örnekler:</div>
        <pre className="lc-textarea preview">{lectureText.slice(0, 400) || "LEC boş"}</pre>
        <pre className="lc-textarea preview">{slidesText.slice(0, 400) || "SLIDE boş"}</pre>
      </Section>
    </div>
  );
}

/** -------- Quiz -------- */
function QuizPane({
  quiz, setQuiz, hasPlan, plan, lectureText, slidesText,
}: {
  quiz: string[];
  setQuiz: (q: string[]) => void;
  hasPlan: boolean;
  plan: any | null;
  lectureText: string;
  slidesText: string;
}) {
  const [answers, setAnswers] = React.useState<Record<number, {
    short_answer: string;
    explanation: string;
    evidence: { lec?: { quote: string }[]; slide?: { quote: string }[] };
    confidence: number;
  }>>({});

  const [pack, setPack] = React.useState<any | null>(null);
  const [answersById, setAnswersById] = React.useState<Record<string, string | boolean>>({});
  const [result, setResult] = React.useState<any | null>(null);
  const [loading, setLoading] = React.useState(false);

  const createQuiz = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE}/api/quiz/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count: 10 })
      });
      const p = await r.json();
      if (p?.error) { alert(p.error); return; }
      setPack(p);
      setAnswersById({});
      setResult(null);
      const qlist = (p.items || []).map((q: any) => q.prompt);
      setQuiz(qlist);
    } catch (e: any) {
      alert(e?.message || "Quiz oluşturulamadı");
    } finally {
      setLoading(false);
    }
  };

  const [loadingAns, setLoadingAns] = React.useState(false);

  async function fetchAnswers() {
    if (!quiz.length || !lectureText || !slidesText) return;
    setLoadingAns(true);
    try {
      const r = await fetch(`${API_BASE}/api/quiz-answers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questions: quiz, lectureText, slidesText, plan }),
      });
      const j = await r.json();
      if (j.ok) {
        const map: Record<number, any> = {};
        (j.answers as any[]).forEach((a, i) => { map[i] = a; });
        setAnswers(map);
      } else {
        alert(j.error || "Cevaplar üretilemedi");
      }
    } catch (e: any) {
      alert(e?.message || "İstek hatası");
    } finally {
      setLoadingAns(false);
    }
  }

  return (
    <div className="grid-gap-12">
      <Section title="Quiz Modu">
        <div className="lc-chipset">
          <div className="lc-chip">Süre: 15–20 dk</div>
          <div className="lc-chip">Yanlışlara mini tekrar</div>
          <div className="lc-chip">Kanıtlı cevaplar</div>
        </div>

        <div className="flex-gap-8">
          <button
            className={!hasPlan ? "btn btn--disabled" : "btn"}
            disabled={!hasPlan}
            onClick={async () => {
              try {
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

          <button className="btn" onClick={createQuiz} disabled={loading}>
            {loading ? "Quiz oluşturuluyor…" : "Vurgulardan Quiz Oluştur"}
          </button>

          <button
            className={quiz.length ? "btn" : "btn btn--disabled"}
            disabled={!quiz.length || loadingAns}
            onClick={fetchAnswers}
          >
            {loadingAns ? "Cevaplar getiriliyor…" : "Cevapları Göster"}
          </button>

          <button
            className={quiz.length ? "btn" : "btn btn--disabled"}
            disabled={!quiz.length}
            onClick={() =>
              navigator.clipboard?.writeText(quiz.map((q, i) => `${i + 1}. ${q}`).join("\n"))
            }
          >
            Soruları Kopyala
          </button>

          {!hasPlan && <span className="hint">Önce “Plan” üret.</span>}
        </div>

        <div className="lc-section pad-top-8">
          {quiz.length ? (
            <ol className="ol-reset">
              {quiz.map((q, i) => (
                <li key={i} className="q-item">
                  <div className="fw-700">{q}</div>

                  {/* Cevap kartı */}
                  {answers[i] ? (
                    <div className="lc-section answer-card">
                      <div><b>Kısa cevap:</b> {answers[i].short_answer}</div>
                      <div className="mt-6">{answers[i].explanation}</div>
                      <div className="lc-chipset mt-8">
                        <div className="lc-chip">
                          Güven: %{Math.round((answers[i].confidence ?? 0) * 100)}
                        </div>
                      </div>
                      <div className="evidence">
                        <b>Kanıt (LEC):</b>{" "}
                        {answers[i].evidence?.lec?.length
                          ? answers[i].evidence.lec.map((e: any) => `“${e.quote}”`).join(" • ")
                          : "—"}
                        <br />
                        <b>Kanıt (SLIDE):</b>{" "}
                        {answers[i].evidence?.slide?.length
                          ? answers[i].evidence.slide.map((e: any) => `“${e.quote}”`).join(" • ")
                          : "—"}
                      </div>
                    </div>
                  ) : (
                    <div className="muted small mt-6">
                      Cevabı görmek için “Cevapları Göster”e tıkla.
                    </div>
                  )}
                </li>
              ))}
            </ol>
          ) : (
            <div className="op-65">
              Henüz soru yok. “10 Soru Üret / Yenile” veya “Vurgulardan Quiz Oluştur”a tıkla.
            </div>
          )}
        </div>
      </Section>
    </div>
  );
}

/** -------- Diğer paneller -------- */
function DeepDivePane() {
  return (
    <div className="grid-gap-12">
      <Section title="Derinleşme (Boşluk Analizi)">
        <textarea className="lc-textarea textarea" placeholder="Eksiğim ne? (Örn: QQ plot yorumu, Ki-kare p-değeri...)" rows={4} />
        <input className="lc-textarea input" placeholder="Kaynak/Link/Sayfa (Slide 21-33, kitap 98-105...)" />
        <div className="flex-gap-8">
          <input className="lc-textarea input narrow" placeholder="Son tarih (YYYY-AA-GG)" />
          <button className="btn">Okuma Listesi Üret</button>
        </div>
        <div className="fs-12 op-60">Her boşluk için ölçülebilir çıktı: “3 örnek soru yorumladım” gibi.</div>
      </Section>
    </div>
  );
}

function ExamSprintPane() {
  return (
    <div className="grid-gap-12">
      <Section title="Sınav Sprinti">
        <div className="lc-chipset">
          <div className="lc-chip">Pomodoro 40–10</div>
          <div className="lc-chip">Son 48 saat: hafif tekrar</div>
          <div className="lc-chip">Yanlışlar listesi</div>
        </div>
        <div className="lc-section op-65">Detaylar yakında.</div>
      </Section>
    </div>
  );
}

/** -------- Utilities -------- */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="lc-section grid-gap-12">
      <div className="fw-800 fs-18">{title}</div>
      {children}
    </section>
  );
}
