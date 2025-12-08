import React, { useEffect, useMemo, useState } from "react";
import "./App.css";
import { API_BASE } from "./config";
import { Plan, ModeId, LoAlignment, LoStudyModule } from "./types";
import LoStudyPane from "./components/LoStudyPane";

// --- Bileşen Importları ---
import PlanPane from "./components/PlanPane";
import AlignmentPane from "./components/AlignmentPane";
import LecturerNotePane from "./components/LecturerNotePane";
import QuizPane from "./components/QuizPane";
import DeepDivePane from "./components/DeepDivePane";
import ExamSprintPane from "./components/ExamSprintPane";
import ModeRibbon from "./components/ModeRibbon";
import LessonsHistoryPane from "./components/LessonsHistoryPane";

/** -------- Helpers -------- */
function getInitialMode(): ModeId {
  const sp = new URLSearchParams(window.location.search);
  const q = sp.get("mode") as ModeId | null;
  const saved = localStorage.getItem("lc.mode") as ModeId | null;
  if (q) return q;
  if (saved) return saved;
  return "plan";
}

export default function App() {
  // State Tanımları
  const [lectureText, setLectureText] = useState("");
  const [slidesText, setSlidesText] = useState("");
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [mode, setMode] = useState<ModeId>(getInitialMode());
  const [quiz, setQuiz] = useState<string[]>([]);

  // Ders State'leri
  const [lessons, setLessons] = useState<any[]>([]);
  const [currentLessonId, setCurrentLessonId] = useState<string | null>(
    localStorage.getItem("lc.lastLessonId")
  );

  // Modal State'leri
  const [showNewLessonModal, setShowNewLessonModal] = useState(false);
  const [newLessonTitle, setNewLessonTitle] = useState("");
  const [draftTitle, setDraftTitle] = useState<string>("");

  // IEU Syllabus / Learning Outcomes
  const [courseCode, setCourseCode] = useState("");
  const [learningOutcomes, setLearningOutcomes] = useState<string[]>([]);
  const [loLoading, setLoLoading] = useState(false);
  const [loAlignment, setLoAlignment] = useState<LoAlignment | null>(null);

  // LO Study modülleri
  const [loModules, setLoModules] = useState<LoStudyModule[] | null>(null);
  const [loModulesLoading, setLoModulesLoading] = useState(false);

  // Submit butonu aktiflik kontrolü
  const canSubmit = useMemo(
    () =>
      !loading &&
      lectureText.trim().length > 0 &&
      slidesText.trim().length > 0,
    [loading, lectureText, slidesText]
  );

  // URL & Storage Senkronizasyonu
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("mode", mode);
    window.history.replaceState({}, "", url.toString());
    localStorage.setItem("lc.mode", mode);
  }, [mode]);

  // Klavye Kısayolları
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        (e.target as HTMLElement)?.closest(
          "input,textarea,[contenteditable=true]"
        )
      )
        return;
      const map: Record<string, ModeId> = {
        "1": "plan",
        "2": "alignment",
        "3": "lecturer-note",
        "4": "quiz",
        "5": "deep-dive",
        "6": "exam-sprint",
        "7": "history",
        "8": "lo-study",
      };
      if (map[e.key]) setMode(map[e.key]);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Ders Listesini Yükle
  useEffect(() => {
    fetchLessons();
  }, []);

  const fetchLessons = async () => {
    try {
      const r = await fetch(`${API_BASE}/api/lessons`);
      const j = await r.json();
      if (Array.isArray(j)) setLessons(j);
    } catch (e) {
      console.warn("Dersler yüklenemedi", e);
    }
  };

  // Ders değiştiğinde LO modüllerini sıfırla
  useEffect(() => {
    setLoModules(null);
  }, [currentLessonId]);

  // Seçili Dersi ve Detaylarını Getir
  useEffect(() => {
    if (!currentLessonId) {
      // Eğer ders seçili değilse ve taslak başlık yoksa formları temizle
      if (!draftTitle) {
        setLectureText("");
        setSlidesText("");
        setPlan(null);
        setCourseCode("");
        setLearningOutcomes([]);
        setLoAlignment(null);
        setLoModules(null);
      }
      return;
    }

    fetch(`${API_BASE}/api/lessons/${currentLessonId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((l) => {
        if (l) {
          setLectureText(l.transcript || "");
          setSlidesText(l.slideText || "");
          if (l.plan) setPlan(l.plan);

          // 🔹 yeni alanlar
          if (l.courseCode) setCourseCode(l.courseCode);
          if (Array.isArray(l.learningOutcomes))
            setLearningOutcomes(l.learningOutcomes);
          setLoAlignment(l.loAlignment || null);
          if (Array.isArray(l.loModules?.modules)) {
            setLoModules(l.loModules.modules);
          } else {
            setLoModules(null);
          }

          setLessons((prev) =>
            prev.map((item) =>
              item.id === l.id ? { ...item, title: l.title } : item
            )
          );
        }
      })
      .catch(console.warn);
  }, [currentLessonId, draftTitle]);

  // --- PDF YÜKLEME ---
  const handlePdfUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const r = await fetch(`${API_BASE}/api/upload/pdf`, {
        method: "POST",
        body: formData,
      });
      const j = await r.json();
      if (j.ok && j.text) {
        setSlidesText((prev) => (prev ? prev + "\n\n" : "") + j.text);
      } else {
        alert("Hata: " + (j.error || "Bilinmeyen hata"));
      }
    } catch (err: any) {
      alert("Yükleme başarısız: " + err.message);
    } finally {
      setLoading(false);
      e.target.value = "";
    }
  };

  // --- Transcript + LO hizalama ---
  async function handleAlignWithLO() {
    if (!currentLessonId) {
      setErr("Önce bir ders oluştur veya seç.");
      return;
    }
    if (!learningOutcomes.length) {
      setErr("Önce IEU'den Learning Outcomes çek.");
      return;
    }
    if (!lectureText.trim()) {
      setErr("Transcript boş, hizalanacak metin yok.");
      return;
    }

    setLoading(true);
    setErr(null);

    try {
      const r = await fetch(
        `${API_BASE}/api/lessons/${currentLessonId}/lo-align`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            transcript: lectureText,
            slidesText,
            learningOutcomes,
          }),
        }
      );
      const j = await r.json();
      if (!r.ok || !j.ok) {
        throw new Error(j.error || "LO hizalama hatası");
      }
      setLoAlignment(j.loAlignment || null);
    } catch (e: any) {
      setErr(e.message || "LO hizalama hatası");
    } finally {
      setLoading(false);
    }
  }

  // --- IEU LEARNING OUTCOMES ÇEKME ---
  async function fetchLearningOutcomes() {
    const code = courseCode.trim();
    if (!code) return;
    setLoLoading(true);
    setErr(null);

    try {
      const r = await fetch(
        `${API_BASE}/api/ieu/learning-outcomes?code=${encodeURIComponent(
          code
        )}`
      );
      const j = await r.json();
      if (!r.ok || !j.ok) {
        throw new Error(j.error || "Learning Outcomes bulunamadı");
      }
      setLearningOutcomes(j.learningOutcomes || []);
    } catch (e: any) {
      setErr(e.message || "LO çekilirken hata");
      setLearningOutcomes([]);
    } finally {
      setLoLoading(false);
    }
  }

  // --- LO STUDY MODÜLLERİ OLUŞTURMA ---
  async function handleGenerateLoModules() {
    if (!currentLessonId) {
      setErr("Önce bir ders oluştur veya seç.");
      return;
    }
    if (!learningOutcomes.length) {
      setErr(
        "LO Study için önce IEU'den Learning Outcomes çekmen gerekiyor."
      );
      return;
    }

    setLoModulesLoading(true);
    setErr(null);

    try {
      const r = await fetch(
        `${API_BASE}/api/lessons/${currentLessonId}/lo-modules`,
        { method: "POST" }
      );
      const j = await r.json();
      if (!r.ok || !j.ok) {
        throw new Error(j.error || "LO modülleri üretilemedi");
      }
      setLoModules(j.modules || []);
      setMode("lo-study");
    } catch (e: any) {
      setErr(e.message || "LO modülleri üretilemedi");
    } finally {
      setLoModulesLoading(false);
    }
  }

  // --- ANA PLAN OLUŞTURMA (SUBMIT) ---
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setErr(null);
    setPlan(null);
    setQuiz([]);
    setLoAlignment(null);
    setLoModules(null);

    try {
      // 🎯 İSİM OVERWRITE BUG FİX:
      const currentLesson = lessons.find(
        (l) => l.id === currentLessonId
      );

      const titleToSend =
        draftTitle ||
        currentLesson?.title ||
        `Lecture ${new Date().toLocaleDateString()}`;

      const r = await fetch(`${API_BASE}/api/plan-from-text`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lectureText,
          slidesText,
          title: titleToSend, // Backend'e "Bu ismi kullan" diyoruz
          lessonId: currentLessonId ?? undefined,
          courseCode: courseCode.trim() || undefined,
          learningOutcomes: learningOutcomes.length
            ? learningOutcomes
            : undefined,
        }),
      });
      const j = await r.json();
      if (!r.ok || !j?.ok) throw new Error(j?.error || "Hata");

      if (j.lessonId) {
        setCurrentLessonId(j.lessonId);
        localStorage.setItem("lc.lastLessonId", j.lessonId);

        // Listeyi güncelle (Varsa ismini koru/güncelle, yoksa ekle)
        setLessons((prev) => {
          const exists = prev.find((x) => x.id === j.lessonId);
          if (exists) return prev; // Zaten listede varsa elleme
          return [
            {
              id: j.lessonId,
              title: titleToSend,
              date: new Date().toISOString(),
            },
            ...prev,
          ];
        });

        setDraftTitle(""); // Taslak modundan çık
        await fetchLessons(); // Listeyi backend'den tazelemek en garantisi
      }

      setPlan(j.plan);
      if (j.plan?.seed_quiz?.length)
        setQuiz(j.plan.seed_quiz.slice(0, 12));
      setMode("alignment");
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  // --- YENİ DERS OLUŞTURMA ---
  const handleCreateLesson = async () => {
    const name = newLessonTitle.trim();
    if (!name) return;

    // Formu temizle
    setLectureText("");
    setSlidesText("");
    setPlan(null);
    setQuiz([]);
    setDraftTitle(name);
    setCourseCode("");
    setLearningOutcomes([]);
    setLoAlignment(null);
    setLoModules(null);

    // Backend'de boş ders oluştur
    try {
      const r = await fetch(`${API_BASE}/api/lessons`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: name }),
      });
      const j = await r.json();

      if (r.ok && j.id) {
        // Başarılıysa listeye ekle ve seç
        setLessons((prev) => [
          { id: j.id, title: j.title, date: new Date().toISOString() },
          ...prev,
        ]);
        setCurrentLessonId(j.id);
        localStorage.setItem("lc.lastLessonId", j.id);
        setDraftTitle(""); // Artık taslak değil, gerçek ID'si var
      } else {
        // Hata olduysa veya ID dönmediyse local taslak olarak devam et
        setCurrentLessonId(null);
      }
    } catch (e) {
      console.error("Ders oluşturma hatası:", e);
      setCurrentLessonId(null);
    }

    setShowNewLessonModal(false);
    setNewLessonTitle("");
  };

return (
  <div className="page">
    {/* Navbar */}
    <div className="nav">
      <div className="nav-inner">
        <div className="brand">
          <span className="brand-text">LearnCraft</span>
        </div>
        <div className="flex-1" />
        <div className="pill">v2.1 (Analyst Mode)</div>
      </div>
    </div>

    <div className="lc-container">

        <header className="hero">
          <h1 className="h1">Ders Planlayıcı &amp; Analiz</h1>
        </header>

        <div className="lc-shell">
          {/* SOL: Form */}
          <div className="lc-sticky">
            <form className="card" onSubmit={handleSubmit}>
              <label className="label">Ders Seçimi</label>
              <select
                className="lc-select mb-4"
                value={currentLessonId ?? (draftTitle ? "__draft__" : "")}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === "__new__") {
                    setShowNewLessonModal(true);
                    // Select'in görsel olarak "Yeni Ders"te kalmasını engellemek için:
                    e.target.value = currentLessonId ?? "";
                    return;
                  }
                  if (val === "__draft__") return; // Taslak seçiliyse bir şey yapma

                  setCurrentLessonId(val === "" ? null : val);
                  if (val) localStorage.setItem("lc.lastLessonId", val);
                  else localStorage.removeItem("lc.lastLessonId");
                }}
              >
                <option value="" className="muted">
                  -- Seçiniz --
                </option>
                <option value="__new__" className="fw-700">
                  ➕ Yeni Ders Oluştur
                </option>
                {draftTitle && (
                  <option value="__draft__">📝 Taslak: {draftTitle}</option>
                )}
                {lessons.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.title}
                  </option>
                ))}
              </select>

              {/* Ders Kodu & LO Çekme */}
              <label className="label mt-2">Ders Kodu (IEU Syllabus)</label>
              <div className="flex-between mb-2" style={{ gap: 8 }}>
                <input
                  className="lc-textarea input"
                  placeholder="Örn: MATH 153"
                  value={courseCode}
                  onChange={(e) => setCourseCode(e.target.value)}
                />
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={fetchLearningOutcomes}
                  disabled={!courseCode.trim() || loLoading}
                >
                  {loLoading ? "LO Çekiliyor..." : "LO Çek"}
                </button>
              </div>

              {learningOutcomes.length > 0 && (
                <div className="muted-block small mb-3">
                  <div
                    style={{ fontWeight: 600, marginBottom: 4 }}
                  >
                    Learning Outcomes
                  </div>
                  <ol className="ol">
                    {learningOutcomes.map((lo, i) => (
                      <li key={i} className="small">
                        {`LO${i + 1}`} – {lo}
                      </li>
                    ))}
                  </ol>

                  {/* 🔹 Transcript–LO hizalama butonu */}
                  <button
                    type="button"
                    className="btn btn-ghost mt-2"
                    onClick={handleAlignWithLO}
                    disabled={!currentLessonId || loading}
                  >
                    {loading ? "Hizalanıyor..." : "Transcript ile eşleştir"}
                  </button>

                  {/* 🔹 LO Study Modu butonu */}
                  <button
                    type="button"
                    className="btn btn-ghost mt-2"
                    onClick={handleGenerateLoModules}
                    disabled={
                      !currentLessonId ||
                      loModulesLoading ||
                      !learningOutcomes.length
                    }
                  >
                    {loModulesLoading
                      ? "LO Study oluşturuluyor..."
                      : "LO Study Modu Oluştur"}
                  </button>
                </div>
              )}

              {/* PDF Upload Butonu */}
              <div className="flex-between mb-2">
                <label className="label m-0">Slide</label>
                <div className="file-upload-wrapper">
                  <label
                    htmlFor="pdf-upload"
                    className="btn-small text-xs cursor-pointer"
                    style={{
                      border: "1px solid #ccc",
                      padding: "2px 8px",
                      borderRadius: "4px",
                    }}
                  >
                    📄 PDF Yükle
                  </label>
                  <input
                    id="pdf-upload"
                    type="file"
                    accept=".pdf"
                    onChange={handlePdfUpload}
                    style={{ display: "none" }}
                  />
                </div>
              </div>
              <textarea
                className="lc-textarea textarea"
                value={slidesText}
                onChange={(e) => setSlidesText(e.target.value)}
                placeholder="Slayt içeriği buraya gelecek..."
                rows={6}
              />

              <label className="label mt-4">
                Speech to Text (Transcript)
              </label>
              <textarea
                className="lc-textarea textarea"
                value={lectureText}
                onChange={(e) => setLectureText(e.target.value)}
                placeholder="Video transcripti buraya..."
                rows={6}
              />

              <div className="actions mt-4">
                <button
                  type="submit"
                  disabled={!canSubmit}
                  className={canSubmit ? "btn" : "btn btn--disabled"}
                >
                  {loading ? "Analiz Ediliyor..." : "Planla ve Analiz Et"}
                </button>
                {err && (
                  <div className="error mt-2 text-red-500 text-sm">
                    {err}
                  </div>
                )}
              </div>
            </form>
          </div>

          {/* SAĞ: Paneller */}
          <div className="lc-plan-pane">
            <ModeRibbon mode={mode} setMode={setMode} />

            {mode === "plan" &&
              (plan ? (
                <PlanPane plan={plan} />
              ) : (
                <div className="muted-block">
                  Henüz plan oluşturulmadı. Soldan veri giriniz.
                </div>
              ))}

            {mode === "alignment" &&
              (plan ? (
                <AlignmentPane plan={plan} />
              ) : (
                <div className="muted-block">
                  Eşleştirme verisi yok.
                </div>
              ))}

            {mode === "lecturer-note" && (
              <LecturerNotePane
                lectureText={lectureText}
                slidesText={slidesText}
                emphases={plan?.emphases || []}
                learningOutcomes={learningOutcomes}
                loAlignment={loAlignment}
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

            {mode === "lo-study" && (
              <LoStudyPane modules={loModules || []} />
            )}

            {mode === "history" && (
              <LessonsHistoryPane
                currentLessonId={currentLessonId} // 👈 Artık hangi derste olduğunu biliyor
                setMode={setMode}
                setQuiz={setQuiz}
                onSelectLesson={(id) => {
                  setCurrentLessonId(id);
                  setMode("plan");
                }}
              />
            )}
            {mode === "deep-dive" && <DeepDivePane />}
            {mode === "exam-sprint" && <ExamSprintPane />}
          </div>
        </div>
      </div>

      {/* Yeni Ders Modal */}
      {showNewLessonModal && (
        <div
          className="modal-backdrop"
          onClick={() => setShowNewLessonModal(false)}
        >
          <div
            className="modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-title h3 mb-4">Yeni Ders Oluştur</div>
            <input
              autoFocus
              className="lc-textarea input mb-4 w-full"
              placeholder="Örn: Calculus 101"
              value={newLessonTitle}
              onChange={(e) => setNewLessonTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateLesson();
                if (e.key === "Escape") setShowNewLessonModal(false);
              }}
            />
            <div className="modal-actions flex justify-end gap-2">
              <button
                className="btn btn-secondary"
                onClick={() => setShowNewLessonModal(false)}
              >
                İptal
              </button>
              <button
                className="btn btn-primary"
                onClick={handleCreateLesson}
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
