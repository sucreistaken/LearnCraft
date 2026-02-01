import React, { useState, useEffect, useCallback, useRef } from "react";
import toast from "react-hot-toast";
import { API_BASE } from "../config";
import { Plan } from "../types";
import { useLessonStore } from "../stores/lessonStore";
import { exportToPdf } from "../utils/pdfExport";

const QUIZ_ANSWERS_KEY_PREFIX = 'lc.quiz.answers.';

export default function QuizPane({
  quiz, setQuiz, hasPlan, plan, lectureText, slidesText,
}: {
  quiz: string[];
  setQuiz: (q: string[]) => void;
  hasPlan: boolean;
  plan: Plan | null;
  lectureText: string;
  slidesText: string;
}) {
  const { currentLessonId } = useLessonStore();
  const [answers, setAnswers] = useState<Record<number, any>>({});
  const [loading, setLoading] = useState(false);
  const [loadingAns, setLoadingAns] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const quizContentRef = useRef<HTMLDivElement>(null);

  const handleExportPdf = async () => {
    if (!quizContentRef.current) return;
    setPdfLoading(true);
    try {
      await exportToPdf(quizContentRef.current, "Quiz");
    } catch (err) {
      console.error("PDF export error:", err);
    } finally {
      setPdfLoading(false);
    }
  };

  // Load answers from localStorage when lesson changes
  useEffect(() => {
    if (!currentLessonId) {
      setAnswers({});
      return;
    }

    const storageKey = QUIZ_ANSWERS_KEY_PREFIX + currentLessonId;
    const savedData = localStorage.getItem(storageKey);

    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        setAnswers(parsed || {});
      } catch (e) {
        console.error('Failed to parse saved quiz answers:', e);
        setAnswers({});
      }
    } else {
      setAnswers({});
    }
  }, [currentLessonId]);

  // Save answers to localStorage whenever they change
  useEffect(() => {
    if (!currentLessonId || Object.keys(answers).length === 0) return;

    const storageKey = QUIZ_ANSWERS_KEY_PREFIX + currentLessonId;
    localStorage.setItem(storageKey, JSON.stringify(answers));
  }, [answers, currentLessonId]);

  // 1. Plandan Quiz Üretme (Mevcut Plan Varsa)
  const generateQuizFromPlan = async () => {
    if (!plan) return;
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE}/api/quiz-from-plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const j = await r.json();
      if (j.ok && Array.isArray(j.questions)) {
        setQuiz(j.questions);
        setAnswers({}); // Yeni quiz gelince eski cevapları sil
        // Clear old answers from localStorage
        if (currentLessonId) {
          localStorage.removeItem(QUIZ_ANSWERS_KEY_PREFIX + currentLessonId);
        }
      } else {
        toast.error(j.error || "Quiz üretilemedi");
      }
    } catch (e: any) {
      toast.error("Hata: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  // 2. Rastgele Quiz Oluştur (Opsiyonel / Yedek)
  const createRandomQuiz = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE}/api/quiz/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count: 5 })
      });
      const p = await r.json();
      if (p?.items) {
        const qlist = p.items.map((q: any) => q.prompt);
        setQuiz(qlist);
        setAnswers({});
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  // 3. Cevapları Getir
  async function fetchAnswers() {
    if (!quiz.length) return;
    setLoadingAns(true);
    try {
      const r = await fetch(`${API_BASE}/api/quiz-answers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questions: quiz, lectureText, slidesText, plan }),
      });
      const j = await r.json();
      if (j.ok && j.answers) {
        const map: Record<number, any> = {};
        j.answers.forEach((a: any, i: number) => { map[i] = a; });
        setAnswers(map);
      } else {
        toast.error("Cevaplar alınamadı.");
      }
    } catch (e: any) {
      toast.error("Hata: " + e.message);
    } finally {
      setLoadingAns(false);
    }
  }

  return (
    <div className="grid-gap-12">
      <section className="lc-section grid-gap-12">
        <div className="fw-800 fs-18">Quiz Modu</div>
        <div className="lc-chipset">
          <div className="lc-chip">Süre: 15–20 dk</div>
          <div className="lc-chip">Kanıtlı cevaplar</div>
        </div>

        {/* BUTON GRUBU */}
        <div className="flex-gap-8" style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>

          {/* Buton 1: Plandan Quiz Oluştur */}
          <button
            className={hasPlan ? "btn btn-primary" : "btn btn--disabled"}
            onClick={generateQuizFromPlan}
            disabled={!hasPlan || loading}
          >
            {loading ? "Oluşturuluyor..." : "Plandan Quiz Oluştur"}
          </button>

          {/* Buton 2: Cevapları Göster */}
          <button
            className={quiz.length ? "btn" : "btn btn--disabled"}
            onClick={fetchAnswers}
            disabled={!quiz.length || loadingAns}
          >
            {loadingAns ? "Cevaplar Getiriliyor..." : "Cevapları Göster"}
          </button>

          {/* PDF Export */}
          {quiz.length > 0 && (
            <button className="btn btn-secondary" onClick={handleExportPdf} disabled={pdfLoading}>
              {pdfLoading ? "Exporting..." : "PDF Export"}
            </button>
          )}

          {/* Buton 3: Soruları Kopyala */}
          {quiz.length > 0 && (
            <button className="btn btn-ghost" onClick={() => { navigator.clipboard.writeText(quiz.join("\n")); toast.success("Kopyalandı!"); }}>
              Kopyala
            </button>
          )}
        </div>

        {/* UYARI MESAJI */}
        {!hasPlan && (
          <div className="op-60 fs-12 mt-2">
            ⚠️ Quiz oluşturmak için önce soldaki panelden ders verisi girip "Planla" butonuna basmalısınız.
          </div>
        )}

        {/* SORU LİSTESİ */}
        <div ref={quizContentRef}>
        <div className="lc-section pad-top-8 mt-4">
          {quiz.length ? (
            <ol className="ol-reset">
              {quiz.map((q, i) => (
                <li key={i} className="q-item">
                  <div className="fw-700 mb-2">{q}</div>

                  {/* Cevap Kartı */}
                  {answers[i] ? (
                    <div className="lc-section answer-card" style={{ background: "var(--input-bg)", border: "1px solid var(--border)" }}>
                      <div className="mb-2"><b>Kısa Cevap:</b> {answers[i].short_answer}</div>
                      <div className="mb-2 op-80">{answers[i].explanation}</div>

                      {/* Kanıtlar */}
                      {answers[i].evidence && (
                        <div className="evidence text-xs mt-3 p-2 bg-white rounded border">
                          <div className="op-60 mb-1">🔍 KANIT:</div>
                          {answers[i].evidence.lec?.map((e: any, k: number) => <div key={k} className="mb-1">"{e.quote}"</div>)}
                          {answers[i].evidence.slide?.map((e: any, k: number) => <div key={k} className="mb-1">"{e.quote}"</div>)}
                        </div>
                      )}
                    </div>
                  ) : null}
                </li>
              ))}
            </ol>
          ) : (
            <div className="op-65 text-center p-8">
              Henüz soru yok. "Plandan Quiz Oluştur" butonuna tıklayın.
            </div>
          )}
        </div>
        </div>
      </section>
    </div>
  );
}