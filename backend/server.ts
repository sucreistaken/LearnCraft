// backend/server.ts
import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import { GoogleGenerativeAI } from "@google/generative-ai";

const app = express();
app.use(cors());
// Metinler uzun olabileceği için limiti biraz yükselttik:
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
  try { return JSON.parse(s); } catch { return null; }
};

// ---- sağlık testi
app.get("/health", (_req, res) => res.json({ ok: true }));

/**
 * POST /api/plan-from-text
 * Body: { lectureText: string, slidesText: string }
 * Amaç: Hocanın konuşma metni + slayt metninden kişisel öğrenme planı üretmek (JSON)
 */
app.post("/api/plan-from-text", async (req, res) => {
  try {
    const { lectureText, slidesText } = req.body as {
      lectureText?: string;
      slidesText?: string;
    };

    if (!lectureText || !slidesText) {
      return res.status(400).json({
        ok: false,
        error: "lectureText ve slidesText zorunludur"
      });
    }

    // Metinleri çok uzunsa kırp (Gemini için pratik bir güvenlik)
    const LEC = lectureText.slice(0, 8000);
    const SLD = slidesText.slice(0, 8000);

    const prompt = `
Sen bir eğitim tasarımcısın. Sana bir dersin öğretmen konuşma metni (LEC) ve slayt metni (SLIDE) verilecektir.
Bu iki kaynaktaki bilgileri birleştirerek öğrencinin çalışması için net ve uygulanabilir bir öğrenme planı üret.

KOŞULLAR:
- Çıktıyı SADECE geçerli JSON olarak ver (başka açıklama yazma).
- İçerikte tekrarı azalt, başlıkları kısa ve net tut.
- Zamanları dakika bazında ver.
- Her derste en az 1 pratik aktivite olsun.
- Gerekli görürsen "mini_quiz" için 3 kısa örnek soru ekle.

GİRDİLER:
[LEC]
${LEC}

[SLIDE]
${SLD}

JSON ŞEMASI:
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
          "mini_quiz": string[]  // 0-3 kısa soru
        }
      ]
    }
  ],
  "resources": string[]
}
`.trim();

    // ⚡️ Önerilen model (v1beta 404 sorunlarını yaşamaz)
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    // İçerik üret
    const result = await model.generateContent(prompt);
    const rawText = result.response.text() || "";

    // JSON'ı temizle & parse et
    const cleaned = stripCodeFences(rawText);
    const plan = tryParseJSON(cleaned);

    if (!plan) {
      console.error("[Parse FAIL] LLM text (first 2k chars):", cleaned.slice(0, 2000));
      return res.status(500).json({
        ok: false,
        error: "LLM JSON parse hatası",
        llmText: cleaned.slice(0, 2000)
      });
    }

    return res.json({ ok: true, plan });
  } catch (e: any) {
    console.error("[/api/plan-from-text ERROR]", e?.message || e);
    return res.status(500).json({
      ok: false,
      error: e?.message || "server error"
    });
  }
});



/**
 * POST /api/quiz-from-plan
 * Body: { plan: Plan }
 * Çıktı: { ok: true, questions: string[] }
 */
app.post("/api/plan-from-text", async (req, res) => {
  try {
    const { lectureText, slidesText } = req.body as {
      lectureText?: string;
      slidesText?: string;
    };

    if (!lectureText || !slidesText) {
      return res.status(400).json({ ok: false, error: "lectureText ve slidesText zorunludur" });
    }

    const LEC = lectureText.slice(0, 8000);
    const SLD = slidesText.slice(0, 8000);

    const prompt = `
Eğitim tasarımcısı gibi çalış. Aşağıdaki öğretmen konuşması (LEC) ve slayt metninden (SLIDE)
uygulanabilir bir öğrenme planı üret. Ayrıca öğretmenin "özellikle vurguladığı" noktaları otomatik tespit et.
Eğer vurgulanan nokta slaytta yoksa bunu belirt.

ÇIKTIYI SADECE GEÇERLİ JSON OLARAK VER.

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

  "emphases": [                 // Hoca vurgu listesi – otomatik çıkarım
    {
      "statement": "string",    // kısa vurgu cümlesi
      "why": "string",          // niçin önemli
      "in_slides": boolean,     // slaytlarda var mı?
      "evidence": "string",     // slayt sayfa/cümle ya da 'yok'
      "confidence": 0.0         // 0-1 arası güven
    }
  ],

  "seed_quiz": string[]         // 8-12 kısa soru (A/B/C şıkları olmadan)
}

KURALLAR:
- "emphases" en az 5 öğe içersin; kısa ve sınava dönebilecek netlikte olsun.
- "in_slides" ve "evidence" alanlarını doldur. SLIDE'da yoksa "yok" yaz.
- "seed_quiz" soruları tek satır kısa soru olsun.

[LEC]
${LEC}

[SLIDE]
${SLD}
`.trim();

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const result = await model.generateContent(prompt);
    const rawText = result.response.text() || "";
    const cleaned = stripCodeFences(rawText);
    const plan = tryParseJSON(cleaned);

    if (!plan) {
      console.error("[Parse FAIL] LLM text (first 2k chars):", cleaned.slice(0, 2000));
      return res.status(500).json({ ok: false, error: "LLM JSON parse hatası", llmText: cleaned.slice(0, 2000) });
    }

    return res.json({ ok: true, plan });
  } catch (e: any) {
    console.error("[/api/plan-from-text ERROR]", e?.message || e);
    return res.status(500).json({ ok: false, error: e?.message || "server error" });
  }
});




app.post("/api/quiz-from-plan", async (req, res) => {
  try {
    const { plan } = req.body as { plan?: any };
    if (!plan) return res.status(400).json({ ok:false, error:"plan yok" });

    const prompt = `
Aşağıdaki plana göre 10 kısa quiz sorusu üret. Yalnızca soru cümlelerini ver, tek satır olsun.
PLAN:
${JSON.stringify(plan).slice(0, 8000)}
`.trim();

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const result = await model.generateContent(prompt);
    const text = (result.response.text() || "").replace(/```/g,"").trim();
    const questions = text.split(/\n+/).map(s => s.replace(/^\d+\.\s*/,"").trim()).filter(Boolean).slice(0,10);

    res.json({ ok:true, questions });
  } catch (e:any) {
    res.status(500).json({ ok:false, error:e?.message || "server error" });
  }
});



// ---- sunucu
const PORT = Number(process.env.PORT || 4000);
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Backend çalışıyor: http://localhost:${PORT}`);
});
