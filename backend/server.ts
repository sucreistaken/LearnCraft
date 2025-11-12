/*
Hocanın konuşmasıyla PDF’teki içeriğin eşleşen kısımlarını gösterip, bu doğrultuda hem slaytta hem de konuşmasında vurguladığı noktaları özellikle belirtmesi.
İki metni karşılaştırarak, hocanın sözel olarak vurguladığı kısımların hangi konu başlıkları ya da kavramlarla ilişkili olduğunu belirlesin ve bunu AI sanki benimle konuşuyormuş gibi anlatsın.
Ayrıca projede alternatif öğrenme yolu: alignment + emphases + süre tahmini ile kişisel plan.
*/

import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import { GoogleGenerativeAI } from "@google/generative-ai";

// ✅ TEK controller kaynağı: tüm ders & quiz ilişkilendirme burada
import {
  // ders bazlı
  listLessons, getLesson, upsertLesson, updateProgress, getMemory,
  // quiz ilişkilendirme
  attachQuizPack, setQuizScore,
} from "./controllers/lessonControllers";

import {
  generateQuizFromEmphases, getQuizPack, scoreQuizPack
} from "../backend/controllers/quizController";

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

// ---- ENV kontrol
const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
  console.error("GEMINI_API_KEY bulunamadı. Lütfen backend/.env dosyasına ekleyin.");
  process.exit(1);
}



// --- en üste (importların altına) küçük bir type ve type-guard:
type QuizPackT = { id: string; items: any[]; createdAt?: string };
function isQuizPack(x: any): x is QuizPackT {
  return !!x && typeof x.id === "string" && Array.isArray(x.items);
}

// ---- Gemini SDK
const genAI = new GoogleGenerativeAI(API_KEY);

// ---- yardımcılar
const stripCodeFences = (s: string) =>
  s.replace(/```json/gi, "").replace(/```/g, "").trim();

const tryParseJSON = (s: string) => {
  try { return JSON.parse(s); } catch { return null; }
};

const hasAlignment = (plan: any) =>
  !!plan?.alignment?.items?.length &&
  Number.isFinite(plan?.alignment?.average_duration_min ?? NaN);

// Alignment’ı tek başına üretmek için odaklı prompt (fallback / yeniden dene için)
async function generateAlignmentOnly(
  genAI: GoogleGenerativeAI,
  lectureText: string,
  slidesText: string
) {
  const LEC = lectureText.slice(0, 18000);
  const SLD = slidesText.slice(0, 18000);

  const prompt = `
İki metni karşılaştırarak SADECE aşağıdaki JSON'u ver. Başka hiçbir şey yazma.

ŞEMA:
{
  "summary_chatty": "string",
  "average_duration_min": number,
  "items": [
    {
      "topic": "string",
      "concepts": string[],
      "in_both": boolean,
      "emphasis_level": "high"|"medium"|"low",
      "lecture_quotes": string[],
      "slide_refs": string[],
      "duration_min": number,
      "confidence": number
    }
  ]
}

KURALLAR:
- "items" en az 5 öğe içerir.
- Süre tahmininde konuşma hızı ~140 wpm varsay; ipucu varsa ona öncelik ver.
- Sadece GEÇERLİ JSON üret.

[LEC]
${LEC}

[SLIDE]
${SLD}
`.trim();

  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  const result = await model.generateContent(prompt);
  const rawText = result.response.text() || "";
  const cleaned = stripCodeFences(rawText);
  const j = tryParseJSON(cleaned);
  if (!j) throw new Error("Alignment JSON parse hatası");
  return j;
}

// ---- sağlık testi
app.get("/health", (_req, res) => res.json({ ok: true }));

/**
 * POST /api/plan-from-text
 * Body:
 *   {
 *     lectureText: string,
 *     slidesText: string,
 *     alignOnly?: boolean,
 *     prevPlan?: any,
 *     lessonId?: string,   // ✅ mevcut dersi güncelle
 *     title?: string       // ✅ yeni ders başlığı (opsiyon)
 *   }
 *
 * Çıktı: { ok: true, plan, lessonId }
 */
app.post("/api/plan-from-text", async (req, res) => {
  try {
    const { lectureText, slidesText, alignOnly, prevPlan, lessonId, title } = req.body as {
      lectureText?: string;
      slidesText?: string;
      alignOnly?: boolean;
      prevPlan?: any;
      lessonId?: string;
      title?: string;
    };

    if (!lectureText || !slidesText) {
      return res
        .status(400)
        .json({ ok: false, error: "lectureText ve slidesText zorunludur" });
    }

    // --- ALIGNMENT ONLY ---
    if (alignOnly) {
      if (!prevPlan) {
        return res
          .status(400)
          .json({ ok: false, error: "alignOnly için prevPlan gereklidir" });
      }
      const alignment = await generateAlignmentOnly(genAI, lectureText, slidesText);
      const plan = { ...prevPlan, alignment };

      // ✅ derse yaz/güncelle
      const saved = upsertLesson({
        id: lessonId,
        title: title || prevPlan?.topic || "Lecture",
        transcript: lectureText,
        slideText: slidesText,
        plan,
        summary: plan?.summary,
        highlights: plan?.key_concepts || [],
        professorEmphases: plan?.emphases || [],
      });

      return res.json({ ok: true, plan, lessonId: saved.id });
    }

    // --- TAM PLAN ÜRETİMİ ---
    const LEC = lectureText.slice(0, 18000);
    const SLD = slidesText.slice(0, 18000);

    const prompt = `
Sen bir eğitim tasarımcısın. Aşağıdaki öğretmen konuşma metni (LEC) ve slayt metnini (SLIDE) birlikte analiz et.

AMAÇ:
1) Uygulanabilir bir öğrenme planı üret.
2) Hoca vurguları (emphases[]) çıkar.
3) İKİ METNİ KARŞILAŞTIRARAK "alignment" üret:
   - konu/kavram eşleşmesi,
   - hem konuşma hem slayt var mı (in_both),
   - vurgu seviyesi (emphasis_level),
   - kısa konuşma alıntıları ve slayt referansları,
   - konuların tahmini anlatım süresi (duration_min) ve güven skoru,
   - sohbet tarzında özet (summary_chatty) ve ortalama süre.

TEK ÇIKTI: SADECE GEÇERLİ JSON.

ŞEMA:
{
  "topic": "string",
  "key_concepts": string[],
  "duration_weeks": number,
  "modules": [
    {
      "title": "string",
      "goal": "string",
      "lessons": [
        {
          "title": "string",
          "objective": "string",
          "study_time_min": number,
          "activities": [
            { "type": "read|watch|practice|quiz|project", "prompt": "string", "expected_outcome": "string" }
          ],
          "mini_quiz": string[]
        }
      ]
    }
  ],
  "resources": string[],

  "emphases": [
    {
      "statement": "string",
      "why": "string",
      "in_slides": boolean,
      "evidence": "string",
      "confidence": 0.0
    }
  ],

  "seed_quiz": string[],

  "alignment": {
    "summary_chatty": "string",
    "average_duration_min": number,
    "items": [
      {
        "topic": "string",
        "concepts": string[],
        "in_both": boolean,
        "emphasis_level": "high"|"medium"|"low",
        "lecture_quotes": string[],
        "slide_refs": string[],
        "duration_min": number,
        "confidence": 0.0
      }
    ]
  }
}

KURALLAR:
- "emphases" ve "alignment.items" için en az 5 öğe üret.
- Süre tahmininde konuşma hızı ~140 wpm varsay; metindeki ipuçları varsa onlara öncelik ver.
- Yalnızca JSON döndür.

[LEC]
${LEC}

[SLIDE]
${SLD}
`.trim();

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const result = await model.generateContent(prompt);
    const rawText = result.response.text() || "";

    const cleaned = stripCodeFences(rawText);
    let plan = tryParseJSON(cleaned);

    if (!plan) {
      console.error("[Parse FAIL] LLM text (first 2k chars):", cleaned.slice(0, 2000));
      return res
        .status(500)
        .json({ ok: false, error: "LLM JSON parse hatası", llmText: cleaned.slice(0, 2000) });
    }

    // Alignment eksikse fallback
    if (!hasAlignment(plan)) {
      try {
        const alignment = await generateAlignmentOnly(genAI, lectureText, slidesText);
        plan = { ...plan, alignment };
      } catch (e) {
        console.warn("[Alignment fallback başarısız]:", (e as any)?.message || e);
      }
    }

    // Ortalama süre yoksa hesapla
    if (!hasAlignment(plan) && plan?.alignment?.items?.length) {
      const items = plan.alignment.items;
      const valid = items.filter((x: any) => Number.isFinite(x?.duration_min));
      const avg =
        valid.reduce((a: number, b: any) => a + b.duration_min, 0) / Math.max(1, valid.length);
      plan.alignment.average_duration_min = Number.isFinite(avg) ? +avg.toFixed(1) : undefined;
    }

    // ✅ DERSİ OLUŞTUR/GÜNCELLE ve lessonId dön
    const inferredTitle =
      title ||
      plan?.topic ||
      (plan?.modules?.[0]?.title ? `Lecture – ${plan.modules[0].title}` : "Lecture");

    const saved = upsertLesson({
      id: lessonId,                // varsa günceller
      title: inferredTitle,
      transcript: lectureText,
      slideText: slidesText,
      plan,
      summary: plan?.summary,
      highlights: plan?.key_concepts || [],
      professorEmphases: plan?.emphases || [],
    });

    return res.json({ ok: true, plan, lessonId: saved.id });
  } catch (e: any) {
    console.error("[/api/plan-from-text ERROR]", e?.message || e);
    return res.status(500).json({ ok: false, error: e?.message || "server error" });
  }
});

/**
 * POST /api/quiz-from-plan
 * Body: { plan: any }
 * Çıktı: { ok: true, questions: string[] }
 */
app.post("/api/quiz-from-plan", async (req, res) => {
  try {
    const { plan } = req.body as { plan?: any };
    if (!plan) {
      return res.status(400).json({ ok: false, error: "plan yok" });
    }

    const prompt = `
Aşağıdaki plana göre 10 kısa quiz sorusu üret. Yalnızca soru cümlelerini ver, tek satır olsun.
PLAN:
${JSON.stringify(plan).slice(0, 8000)}
`.trim();

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const result = await model.generateContent(prompt);
    const text = (result.response.text() || "").replace(/```/g, "").trim();
    const questions = text
      .split(/\n+/)
      .map((s) => s.replace(/^\d+\.\s*/, "").trim())
      .filter(Boolean)
      .slice(0, 10);

    return res.json({ ok: true, questions });
  } catch (e: any) {
    console.error("[/api/quiz-from-plan ERROR]", e?.message || e);
    return res.status(500).json({ ok: false, error: e?.message || "server error" });
  }
});

// Cevap üretimi
app.post("/api/quiz-answers", async (req, res) => {
  try {
    const { questions, lectureText, slidesText, plan } = req.body as {
      questions?: string[]; lectureText?: string; slidesText?: string; plan?: any;
    };
    if (!questions?.length || !lectureText || !slidesText) {
      return res.status(400).json({ ok:false, error:"questions, lectureText, slidesText gerekli" });
    }

    const Q = questions.slice(0, 20);
    const LEC = lectureText.slice(0, 18000);
    const SLD = slidesText.slice(0, 18000);

    const prompt = `
Cevapları KANITLI ver. Yalnızca GEÇERLİ JSON üret.

ŞEMA:
{
  "answers": [
    {
      "q": "string",
      "short_answer": "string",
      "explanation": "string",
      "evidence": {
        "lec": [{ "quote": "string" }],
        "slide": [{ "quote": "string" }]
      },
      "confidence": number
    }
  ]
}

KURALLAR:
- "short_answer": tek satır; mümkünse öz.
- "explanation": 1-3 cümle; neden doğru olduğunu açıkla.
- "evidence": LEC ve SLIDE'dan bire bir alıntılar; uydurma yok.
- Emin değilsen "confidence" düşük olsun ve "explanation"da belirsizliği belirt.

[LEC]
${LEC}

[SLIDE]
${SLD}

[PLAN (opsiyonel)]
${plan ? JSON.stringify(plan).slice(0,6000) : "—"}

[SORULAR]
${Q.map((q,i)=>`${i+1}. ${q}`).join("\n")}
`.trim();

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const result = await model.generateContent(prompt);
    const cleaned = (result.response.text() || "").replace(/```json?/gi,"").replace(/```/g,"").trim();
    const j = (()=>{ try{return JSON.parse(cleaned)}catch{ return null } })();

    if (!j?.answers) return res.status(500).json({ ok:false, error:"JSON parse/şema hatası" });

    return res.json({ ok:true, answers: j.answers });
  } catch (e:any) {
    console.error("[/api/quiz-answers ERROR]", e?.message || e);
    return res.status(500).json({ ok:false, error:e?.message || "server error" });
  }
});

// Tek soruluk değerlendirme
app.post("/api/quiz-eval", async (req, res) => {
  try {
    const { q, student_answer, lectureText, slidesText } = req.body as {
      q?: string; student_answer?: string; lectureText?: string; slidesText?: string;
    };
    if (!q || !student_answer || !lectureText || !slidesText) {
      return res.status(400).json({ ok:false, error:"q, student_answer, lectureText, slidesText gerekli" });
    }

    const LEC = lectureText.slice(0, 14000);
    const SLD = slidesText.slice(0, 14000);

    const prompt = `
Bir sınav değerlendiricisi gibi davran. Sadece GEÇERLİ JSON ver.

ŞEMA:
{
  "grade": "correct" | "partial" | "incorrect",
  "feedback": "string",
  "missing_points": string[],
  "evidence": {
    "lec": [{ "quote": "string" }],
    "slide": [{ "quote": "string" }]
  },
  "confidence": number
}

KURALLAR:
- Önce kanıtı LEC/SLIDE içinden bul; sonra değerlendir.
- "partial": kritik bir-iki nokta eksikse.
- "feedback": kısa ve yapıcı, 2-3 cümle.
- Uydurma yok; alıntılar metinden.

[LEC]
${LEC}

[SLIDE]
${SLD}

[SORU]
${q}

[ÖĞRENCİ CEVABI]
${student_answer}
`.trim();

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const result = await model.generateContent(prompt);
    const cleaned = (result.response.text() || "").replace(/```json?/gi,"").replace(/```/g,"").trim();
    const j = (()=>{ try{return JSON.parse(cleaned)}catch{ return null } })();

    if (!j?.grade) return res.status(500).json({ ok:false, error:"JSON parse/şema hatası" });
    return res.json({ ok:true, ...j });
  } catch (e:any) {
    console.error("[/api/quiz-eval ERROR]", e?.message || e);
    return res.status(500).json({ ok:false, error:e?.message || "server error" });
  }
});

// ---- Ders & Hafıza API (tek kopya)
app.get("/api/lessons", (_req, res) => res.json(listLessons()));
app.get("/api/lessons/:id", (req, res) => {
  const l = getLesson(req.params.id);
  if (!l) return res.status(404).json({ error: "Not found" });
  res.json(l);
});
app.post("/api/lessons", (req, res) => {
  const l = upsertLesson(req.body); // {title, transcript, slideText, plan, ...}
  res.json(l);
});
app.patch("/api/lessons/:id/progress", (req, res) => {
  const l = updateProgress(req.params.id, req.body); // {lastMode, percent}
  if (!l) return res.status(404).json({ error: "Not found" });
  res.json(l);
});
app.get("/api/memory", (_req, res) => res.json(getMemory()));

// 🎯 Quiz API (lessonId ile ilişkilendirilmiş)
app.post("/api/quiz/generate", (req, res) => {
  const { count, lessonIds, lessonId } = req.body as {
    count?: number;
    lessonIds?: string[];
    lessonId?: string;
  };

  const pack = generateQuizFromEmphases(count ?? 5, lessonIds);

  // hata döndüyse aynen ilet
  if (!isQuizPack(pack)) {
    // pack muhtemelen { error: string } şeklinde
    return res.status(400).json(pack);
  }

  // burada artık pack.id güvenli
  if (lessonId) attachQuizPack(lessonId, pack.id);

  return res.json(pack);
});


app.get("/api/quiz/:packId", (req, res) => {
  const pack = getQuizPack(req.params.packId);
  if (!pack) return res.status(404).json({ error: "Not found" });
  res.json(pack);
});

app.post("/api/quiz/:packId/submit", (req, res) => {
  const { answers, lessonId } = req.body as {
    answers: Array<{ id: string; answer: string | boolean }>;
    lessonId?: string;
  };
  const result = scoreQuizPack(req.params.packId, answers || []);
  // ✅ skor derse işlensin
  if (lessonId && typeof result?.score === "number") setQuizScore(lessonId, req.params.packId, result.score);
  res.json(result);
});

// ---- sunucu
const PORT = Number(process.env.PORT || 4000);
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Backend çalışıyor: http://localhost:${PORT}`);
});
