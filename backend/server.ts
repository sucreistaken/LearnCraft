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

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

// ---- ENV kontrol
const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
  console.error("GEMINI_API_KEY bulunamadı. Lütfen backend/.env dosyasına ekleyin.");
  process.exit(1);
}

// ---- Gemini SDK
const genAI = new GoogleGenerativeAI(API_KEY);

// ---- yardımcılar
const stripCodeFences = (s: string) =>
  s.replace(/```json/gi, "").replace(/```/g, "").trim();

const tryParseJSON = (s: string) => {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
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
  "summary_chatty": "string",        // öğrenciyle sohbet eder gibi kısa özet
  "average_duration_min": number,    // tüm konuların ortalama süresi
  "items": [
    {
      "topic": "string",
      "concepts": string[],
      "in_both": boolean,
      "emphasis_level": "high"|"medium"|"low",
      "lecture_quotes": string[],    // max 2 kısa alıntı
      "slide_refs": string[],        // başlık/numara/fragman
      "duration_min": number,        // tahmin
      "confidence": number           // 0..1
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
 *     alignOnly?: boolean,  // true ise sadece alignment üretir (prevPlan zorunlu)
 *     prevPlan?: any
 *   }
 *
 * Çıktı: { ok: true, plan }
 * - Tam üretimde: plan + emphases + seed_quiz + alignment
 * - alignOnly modunda: prevPlan + alignment
 */
app.post("/api/plan-from-text", async (req, res) => {
  try {
    const { lectureText, slidesText, alignOnly, prevPlan } = req.body as {
      lectureText?: string;
      slidesText?: string;
      alignOnly?: boolean;
      prevPlan?: any;
    };

    if (!lectureText || !slidesText) {
      return res
        .status(400)
        .json({ ok: false, error: "lectureText ve slidesText zorunludur" });
    }

    // Sadece alignment istenmişse:
    if (alignOnly) {
      if (!prevPlan) {
        return res
          .status(400)
          .json({ ok: false, error: "alignOnly için prevPlan gereklidir" });
      }
      const alignment = await generateAlignmentOnly(genAI, lectureText, slidesText);
      const plan = { ...prevPlan, alignment };
      return res.json({ ok: true, plan });
    }

    // Tam plan üretimi
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

    // JSON'ı temizle & parse et
    const cleaned = stripCodeFences(rawText);
    let plan = tryParseJSON(cleaned);

    if (!plan) {
      console.error("[Parse FAIL] LLM text (first 2k chars):", cleaned.slice(0, 2000));
      return res
        .status(500)
        .json({ ok: false, error: "LLM JSON parse hatası", llmText: cleaned.slice(0, 2000) });
    }

    // Alignment eksik/boşsa odaklı fallback
    if (!hasAlignment(plan)) {
      try {
        const alignment = await generateAlignmentOnly(genAI, lectureText, slidesText);
        plan = { ...plan, alignment };
      } catch (e) {
        console.warn("[Alignment fallback başarısız]:", (e as any)?.message || e);
      }
    }

    // Son doğrulama: average yoksa hesapla
    if (!hasAlignment(plan) && plan?.alignment?.items?.length) {
      const items = plan.alignment.items;
      const valid = items.filter((x: any) => Number.isFinite(x?.duration_min));
      const avg =
        valid.reduce((a: number, b: any) => a + b.duration_min, 0) /
        Math.max(1, valid.length);
      plan.alignment.average_duration_min = Number.isFinite(avg) ? +avg.toFixed(1) : undefined;
    }

    return res.json({ ok: true, plan });
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

// ---- sunucu
const PORT = Number(process.env.PORT || 4000);
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Backend çalışıyor: http://localhost:${PORT}`);
});
