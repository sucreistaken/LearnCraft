/*
Hocanın konuşmasıyla PDF’teki içeriğin eşleşen kısımlarını gösterip, bu doğrultuda hem slaytta hem de konuşmasında vurguladığı noktaları özellikle belirtmesi.
İki metni karşılaştırarak, hocanın sözel olarak vurguladığı kısımların hangi konu başlıkları ya da kavramlarla ilişkili olduğunu belirlesin ve bunu AI sanki benimle konuşuyormuş gibi anlatsın.
Ayrıca projede alternatif öğrenme yolu: alignment + emphases + süre tahmini ile kişisel plan.
*/

import dotenv from "dotenv";
dotenv.config();
import multer from "multer";
import path from "path";
import os from "os";
import fs from "fs";
import { spawn } from "child_process";
import readline from "readline";
import { EventEmitter } from "events";

import express from "express";
import cors from "cors";
import { GoogleGenerativeAI } from "@google/generative-ai";

// ✅ Single source of truth for lessons & quiz relations
import {
  // lesson based
  listLessons,
  getLesson,
  upsertLesson,
  updateProgress,
  deleteLesson,
  getMemory,
  // quiz attachment
  attachQuizPack,
  setQuizScore,
} from "./controllers/lessonControllers";

import {
  generateQuizFromEmphases,
  getQuizPack,
  scoreQuizPack,
} from "./controllers/quizController";

declare const fetch: any;

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "2mb" }));

// ---- ENV check
const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
  console.error("GEMINI_API_KEY is missing. Please add it to backend/.env.");
  process.exit(1);
}

// --- Types (quiz pack + LO alignment) ---
type QuizPackT = { id: string; items: any[]; createdAt?: string };
function isQuizPack(x: any): x is QuizPackT {
  return !!x && typeof x.id === "string" && Array.isArray(x.items);
}

type LoLink = {
  lo_id: string;      // "LO1"
  lo_title: string;   // e.g. "Classify functions"
  confidence: number; // 0–1
};

export type LoAlignedSegment = {
  index: number;
  text: string;
  lo_links: LoLink[];
};

export type LoAlignment = {
  segments: LoAlignedSegment[];
};

// ---- Gemini SDK
const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

// ---- helpers
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

/**
 * Split transcript into segments.
 * - First split by double newline (paragraph-based).
 * - If there are more than 40 parts, merge them back to ~40 segments.
 * 
 * 
 * 
 */


// ---------------- CHEAT SHEET PROMPT ----------------
function buildCheatSheetPrompt(input: {
  title: string;
  transcript: string;
  slideText: string;
  learningOutcomes?: string[];
  emphases?: any[];
}) {
  const LEC = (input.transcript || "").slice(0, 18000);
  const SLD = (input.slideText || "").slice(0, 12000);
  const LOS = (input.learningOutcomes || [])
    .map((x, i) => `LO${i + 1}: ${String(x || "").trim()}`)
    .join("\n");

  const EMPH = input.emphases ? JSON.stringify(input.emphases).slice(0, 6000) : "—";

  return `
You are an exam-focused teaching assistant.

Goal:
Create a ONE-PAGE "Cheat Sheet" (A4 style) from the lecture transcript + slides.
It must be ultra-condensed, high-signal, and optimized for last-minute revision.

OUTPUT: Return ONLY VALID JSON with this schema:

{
  "title": "string",
  "updatedAt": "ISO_STRING",
  "sections": [
    { "heading": "string", "bullets": ["string", "..."] }
  ],
  "formulas": ["string", "..."],
  "pitfalls": ["string", "..."],
  "quickQuiz": [{ "q": "string", "a": "string" }]
}

Rules:
- sections: 5–9 sections max
- each section bullets: 3–7 bullets max (short!!)
- formulas can be empty array if none
- pitfalls: common traps/mistakes (3–8)
- quickQuiz: 3–6 very short Q/A
- Use the professor emphases as a priority if available.
- If Learning Outcomes exist, reflect them indirectly in sections.

[LESSON TITLE]
${input.title || "Lesson"}

[LEARNING OUTCOMES]
${LOS || "—"}

[PROFESSOR EMPHASES (optional)]
${EMPH}

[TRANSCRIPT]
${LEC}

[SLIDES]
${SLD}
`.trim();
}

// ---------------- CHEAT SHEET ENDPOINT ----------------
app.post("/api/lessons/:id/cheat-sheet", async (req, res) => {
  try {
    const lessonId = req.params.id;
    const lesson = getLesson(lessonId);
    if (!lesson) return res.status(404).json({ ok: false, error: "Lesson not found" });

    const title = lesson.title || "Lesson";
    const transcript = (lesson.transcript || "").trim();
    const slideText = lesson.slideText || "";

    if (!transcript && !slideText) {
      return res.status(400).json({
        ok: false,
        error: "Transcript or slideText is required to build a cheat sheet.",
      });
    }

    const prompt = buildCheatSheetPrompt({
      title,
      transcript,
      slideText,
      learningOutcomes: lesson.learningOutcomes || [],
      emphases: lesson.plan?.emphases || lesson.professorEmphases || [],
    });

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const result = await model.generateContent(prompt);
    const raw = (result.response.text() || "").trim();
    const cleaned = stripCodeFences(raw);
    const j = tryParseJSON(cleaned);

    if (!j?.sections || !Array.isArray(j.sections)) {
      return res.status(500).json({ ok: false, error: "Cheat sheet JSON/schema error" });
    }

    // updatedAt zorunlu olsun
    const cheatSheet = {
      title: j.title || title,
      updatedAt: new Date().toISOString(),
      sections: j.sections,
      formulas: Array.isArray(j.formulas) ? j.formulas : [],
      pitfalls: Array.isArray(j.pitfalls) ? j.pitfalls : [],
      quickQuiz: Array.isArray(j.quickQuiz) ? j.quickQuiz : [],
    };

    const saved = upsertLesson({ id: lessonId, cheatSheet });
    return res.json({ ok: true, lessonId: saved.id, cheatSheet });
  } catch (e: any) {
    console.error("[/api/lessons/:id/cheat-sheet ERROR]", e?.message || e);
    return res.status(500).json({ ok: false, error: e?.message || "server error" });
  }
});


function segmentTranscript(lectureText: string): { index: number; text: string }[] {
  const raw = (lectureText || "").replace(/\r\n/g, "\n");
  let parts = raw
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  if (!parts.length) {
    return [{ index: 0, text: raw.trim() }];
  }

  const MAX_SEGMENTS = 40;
  if (parts.length > MAX_SEGMENTS) {
    const chunkSize = Math.ceil(parts.length / MAX_SEGMENTS);
    const merged: string[] = [];
    for (let i = 0; i < parts.length; i += chunkSize) {
      merged.push(parts.slice(i, i + chunkSize).join("\n\n"));
    }
    parts = merged;
  }

  return parts.map((text, index) => ({ index, text }));
}
const upload = multer({ dest: path.join(os.tmpdir(), "learncraft_uploads") });

type Job = {
  emitter: EventEmitter;
  done: boolean;
  transcript: string;
};

const jobs = new Map<string, Job>();

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}


// ---------- LO STUDY MODULES PROMPT BUILDER ----------
function buildLoModulesPrompt(input: {
  transcript: string;
  slideText: string;
  learningOutcomes: string[];
  loAlignment?: LoAlignment;
  plan?: any;
}): string {
  const LEC = input.transcript.slice(0, 16000);
  const SLD = input.slideText.slice(0, 8000);
  const LO_LIST = input.learningOutcomes
    .map((lo, i) => `LO${i + 1}: ${lo}`)
    .join("\n");

  const ALIGN_SNIPPET = input.loAlignment
    ? JSON.stringify(input.loAlignment).slice(0, 8000)
    : "—";

  const PLAN_SNIPPET = input.plan ? JSON.stringify(input.plan).slice(0, 6000) : "—";

  return `
You are an expert learning designer and exam coach.

GOAL:
Transform the raw transcript and slides into SMALL, HIGH-RECALL learning modules,
each tightly linked to ONE official Learning Outcome (LO). The student wants to
learn the course in the shortest possible time with maximum retention and higher
test scores.

CRITICAL ALIGNMENT RULES:
1.  **STRICT EVIDENCE CHECK**: Only generate content for an LO if there is clear evidence in the Transcript (LEC) or Slides (SLIDE).
2.  **NO HALLUCINATIONS**: If an LO is NOT covered in the provided text, explicitly state that in the "oneLineGist" (e.g., "This LO was not covered in this specific lecture/slide") and keep the other fields minimal or empty. Do NOT invent content to fill the void.
3.  **SOURCE PRIORITY**: Prioritize the Transcript (what the professor actually said) over the Slides for the "Core Ideas" and "Intuitive Explanation". Use Slides for structure and definitions.

CONTEXT (DO NOT REPEAT VERBATIM):
- Raw transcript of the lecture (LEC)
- Slide text (SLIDE)
- Official Learning Outcomes (LO list)
- Optional LO alignment data: which transcript segments are related to which LO
- Optional plan/emphases: topics the professor stressed

[LEARNING OUTCOMES]
${LO_LIST}

[LO_ALIGNMENT (optional)]
${ALIGN_SNIPPET}

[PLAN & EMPHASES (optional)]
${PLAN_SNIPPET}

[TRANSCRIPT - LEC]
${LEC}

[SLIDE]
${SLD}

OUTPUT:
Return ONLY VALID JSON with the following schema:

{
  "modules": [
    {
      "loId": "LO1",
      "loTitle": "string",
      "oneLineGist": "string",
      "coreIdeas": ["string", "..."],
      "mustRemember": ["string", "..."],
      "intuitiveExplanation": "string",
      "examples": [
        { "label": "string", "description": "string" }
      ],
      "typicalQuestions": ["string", "..."],
      "commonTraps": ["string", "..."],
      "miniQuiz": [
        { "question": "string", "answer": "string", "why": "string" }
      ],
      "recommended_study_time_min": number
    }
  ]
}

RULES:
- One module per LO. Use the same LO ids (LO1, LO2, …) as given.
- Focus on clarity, brevity and exam performance: cut fluff, keep signal.
- "coreIdeas" 3–6 bullet points.
- "mustRemember" are the 3–5 key facts that, if forgotten, will cause the student to lose points.
- "intuitiveExplanation" max 6–7 sentences, informal and friendly.
- "typicalQuestions" should sound like realistic exam questions for this LO.
- "commonTraps" describe the most common mistakes or misconceptions.
- "miniQuiz" 2–4 items per LO, very short.
- "recommended_study_time_min" ≈ how many minutes a prepared student needs to review this module.
- DO NOT output any text outside the JSON.
`.trim();
}

/**
 * POST /api/lessons/:id/lo-modules
 * Body can be empty; it will use lesson data.
 * Output: { ok: true, modules: LoStudyModule[], lessonId }
 * 
 */
app.post("/api/transcribe/start", upload.single("file"), async (req, res) => {
  try {
    const file = (req as any).file as Express.Multer.File | undefined;
    const { lessonId } = req.body as { lessonId?: string };
    if (!file) return res.status(400).json({ ok: false, error: "file is required" });

    const jobId = uid();
    const emitter = new EventEmitter();
    jobs.set(jobId, { emitter, done: false, transcript: "" });

    // ✅ pyPath: process.cwd() tuzak (backend klasöründen çalıştırınca backend/backend olur)
    // server.ts backend klasöründeyse __dirname en güvenlisi:
    const pyPath = path.resolve(__dirname, "transcribe", "run.py");
    const pythonBin = process.env.PYTHON_BIN || "python";

    // DEBUG (istersen sonra kaldır)
    console.log("[STT] start", { jobId, lessonId, file: file.originalname, tmp: file.path, pyPath });

    const proc = spawn(pythonBin, [pyPath, file.path, "--lang", "en"], {
      stdio: ["ignore", "pipe", "pipe"],
    });

    proc.stderr.on("data", (d) => {
      const msg = String(d || "").trim();
      if (msg) emitter.emit("msg", { type: "log", message: msg.slice(0, 800) });
    });

    const rl = readline.createInterface({ input: proc.stdout });

    rl.on("line", (line) => {
      try {
        const msg = JSON.parse(line);
        const job = jobs.get(jobId);
        if (!job) return;

        if (msg.type === "segment" && msg.text) {
          job.transcript += `[${Number(msg.start).toFixed(2)} - ${Number(msg.end).toFixed(2)}] ${msg.text}\n`;
        }

        emitter.emit("msg", msg);
      } catch {
        // JSON değilse ignore
      }
    });

    proc.on("close", (code) => {
      const job = jobs.get(jobId);
      if (!job) return;

      job.done = true;
      emitter.emit("msg", { type: "done", progress: 1.0, code });

      // temp cleanup
      try { fs.unlinkSync(file.path); } catch { }

      // lesson’a yaz
      if (lessonId) {
        const existing = getLesson(lessonId);
        if (existing) upsertLesson({ id: lessonId, transcript: job.transcript });
      }

      // job’ı bir süre sonra sil (memory leak olmasın)
      setTimeout(() => jobs.delete(jobId), 5 * 60 * 1000);
    });

    return res.json({ ok: true, jobId });
  } catch (e: any) {
    console.error("[STT] start error:", e);
    return res.status(500).json({ ok: false, error: e?.message || "server error" });
  }
});

/**
 * POST /api/slides/upload
 * Uses Python OCR to extract text from PDF/Image slides.
 */
app.post("/api/slides/upload", upload.single("file"), async (req, res) => {
  try {
    const file = (req as any).file as Express.Multer.File | undefined;
    const { lessonId } = req.body as { lessonId?: string };

    if (!file) return res.status(400).json({ ok: false, error: "No file uploaded" });
    if (!lessonId) return res.status(400).json({ ok: false, error: "lessonId is required" });

    // Path to our new python script
    const pyPath = path.resolve(__dirname, "ocr_service.py");
    const pythonBin = process.env.PYTHON_BIN || "python";

    // ✅ FIX: Multer saves without extension. Python script relies on extension.
    // Rename file to include original extension.
    const originalExt = path.extname(file.originalname);
    const newPath = file.path + originalExt;
    fs.renameSync(file.path, newPath);
    file.path = newPath; // Update reference for cleanup later

    console.log(`[OCR] Starting for lesson ${lessonId}, file: ${file.path}`);

    const proc = spawn(pythonBin, [pyPath, file.path]);

    let stdoutData = "";
    let stderrData = "";

    proc.stdout.on("data", (data) => {
      stdoutData += data.toString();
    });

    proc.stderr.on("data", (data) => {
      stderrData += data.toString();
      console.error("[OCR Stderr]:", data.toString());
    });

    proc.on("close", async (code) => {
      // Clean up uploaded file
      try { fs.unlinkSync(file.path); } catch { }

      if (code !== 0) {
        console.error(`[OCR] Process exited with code ${code}`);
        console.error(`[OCR] Stderr: ${stderrData}`);
        return res.status(500).json({
          ok: false,
          error: "OCR script failed",
          code: code,
          details: stderrData
        });
      }

      // Extract text between markers
      const startMarker = "===OCR_START===";
      const endMarker = "===OCR_END===";

      const startIndex = stdoutData.indexOf(startMarker);
      const endIndex = stdoutData.indexOf(endMarker);

      let extractedText = "";
      if (startIndex !== -1 && endIndex !== -1) {
        extractedText = stdoutData.substring(startIndex + startMarker.length, endIndex).trim();
      } else {
        extractedText = stdoutData.trim();
      }

      // --- NEW: AI IMAGE ANALYSIS ---
      // 1. Find all image markers
      const markerRegex = /\[\[\[IMAGE_ANALYSIS_REQUIRED:(.*?)\]\]\]/g;
      const matches = [...extractedText.matchAll(markerRegex)];

      if (matches.length > 0) {
        console.log(`[AI Analysis] Found ${matches.length} images to analyze...`);

        // 2. Process in parallel
        await Promise.all(matches.map(async (match) => {
          const marker = match[0];
          const imgPath = match[1].trim();

          if (fs.existsSync(imgPath)) {
            try {
              const ext = path.extname(imgPath).toLowerCase().replace(".", "");
              const mimeType = ext === "png" ? "image/png" : "image/jpeg";
              const imgData = fs.readFileSync(imgPath).toString("base64");

              const prompt = "Bu ders slaytındaki görseli analiz et. Eğer bir şema, tablo, grafik veya diyagram ise içeriğini ve ne anlattığını detaylıca (Türkçe) açıkla. Eğer sadece dekoratif bir resim, ikon veya anlamsız bir görsel ise sadece 'SKIP' yaz.";

              const result = await model.generateContent([
                prompt,
                { inlineData: { data: imgData, mimeType } }
              ]);

              const description = result.response.text().trim();

              if (description === "SKIP") {
                extractedText = extractedText.replace(marker, ""); // Remove marker
              } else {
                const formattedDesc = `\n> 🤖 **[Yapay Zeka Görsel Analizi]**\n> ${description.split("\n").join("\n> ")}\n`;
                extractedText = extractedText.replace(marker, formattedDesc);
              }

              // Delete temp image
              fs.unlinkSync(imgPath);

            } catch (err) {
              console.error(`[AI Analysis Error] ${imgPath}:`, err);
              extractedText = extractedText.replace(marker, "\n[Görsel Analizi Başarısız]\n");
            }
          } else {
            extractedText = extractedText.replace(marker, ""); // File missing
          }
        }));
      }

      // Save to lesson
      const lesson = getLesson(lessonId);
      if (lesson) {
        upsertLesson({ id: lessonId, slideText: extractedText });
      }

      return res.json({ ok: true, text: extractedText });
    });

  } catch (e: any) {
    console.error("[OCR] error:", e);
    return res.status(500).json({ ok: false, error: e.message });
  }
});

app.get("/api/transcribe/stream/:jobId", (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) return res.status(404).end("not found");

  res.status(200);
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  // CORS (SSE’de bazen şart)
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.setHeader("Access-Control-Allow-Credentials", "true");

  // bazı env’lerde lazım
  (res as any).flushHeaders?.();

  const send = (msg: any) => {
    res.write(`data: ${JSON.stringify(msg)}\n\n`);
  };

  // ✅ bağlantı canlı kalsın diye heartbeat (proxy’ler SSE’yi öldürmesin)
  const heartbeat = setInterval(() => {
    res.write(`: ping\n\n`);
  }, 15000);

  const onMsg = (msg: any) => send(msg);
  job.emitter.on("msg", onMsg);

  req.on("close", () => {
    clearInterval(heartbeat);
    job.emitter.off("msg", onMsg);
    res.end();
  });
});

app.post("/api/lessons/:id/lo-modules", async (req, res) => {
  try {
    const lessonId = req.params.id;
    const lesson = getLesson(lessonId);
    if (!lesson) return res.status(404).json({ ok: false, error: "Lesson not found" });

    const { transcript, slideText, learningOutcomes, loAlignment, plan } = lesson;
    if (!transcript || !learningOutcomes?.length) {
      return res.status(400).json({
        ok: false,
        error: "Transcript and Learning Outcomes are required to build LO modules.",
      });
    }

    const prompt = buildLoModulesPrompt({
      transcript,
      slideText: slideText || "",
      learningOutcomes,
      loAlignment,
      plan,
    });

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const result = await model.generateContent(prompt);
    const raw = result.response.text() || "";
    const cleaned = stripCodeFences(raw);
    const j = tryParseJSON(cleaned);

    if (!j?.modules || !Array.isArray(j.modules)) {
      return res.status(500).json({ ok: false, error: "LO modules JSON/schema error" });
    }

    const loModules = { lessonId, modules: j.modules };
    const saved = upsertLesson({ id: lessonId, loModules });

    return res.json({ ok: true, modules: loModules.modules, lessonId: saved.id });
  } catch (e: any) {
    console.error("[/api/lessons/:id/lo-modules ERROR]", e?.message || e);
    return res.status(500).json({ ok: false, error: e?.message || "server error" });
  }
});

/**
 * Generates LO–Transcript alignment given transcript segments + LO list.
 * Only returns lo_links; text is stored locally.
 */
async function generateLoAlignmentForLesson(
  genAI: GoogleGenerativeAI,
  lectureText: string,
  slidesText: string,
  learningOutcomes: string[]
): Promise<LoAlignment> {
  const baseSegments = segmentTranscript(lectureText);
  if (!baseSegments.length) {
    throw new Error("Transcript is empty; cannot generate alignment.");
  }

  const LOs = (learningOutcomes || [])
    .map((t) => String(t || "").trim())
    .filter(Boolean);

  if (!LOs.length) {
    throw new Error("Learning Outcomes list is empty; LO alignment requires LOs.");
  }

  const LO_LIST = LOs.map((lo, i) => `LO${i + 1}: ${lo}`).join("\n");
  const SEGMENTS_JSON = JSON.stringify(
    baseSegments.map((s) => ({ index: s.index, text: s.text }))
  ).slice(0, 12000);
  const SLD = (slidesText || "").slice(0, 4000);

  const prompt = `
You are an instructional designer. Below you see the official Learning Outcomes
and pre-segmented transcript blocks.

Task:
- For each transcript segment, link it to 0–3 LOs.
- If no LO is clearly related, keep "lo_links": [].
- Only use the given LO ids (LO1, LO2, ...).

OUTPUT SCHEMA (STRICT):
{
  "segments": [
    {
      "index": number,
      "lo_links": [
        { "lo_id": "LO1", "lo_title": "string", "confidence": number }
      ]
    }
  ]
}

RULES:
- Do NOT change the segment "index" values; do not create new indices.
- Do NOT modify transcript text; only decide lo_links.
- "confidence" is a decimal number between 0 and 1.
- Output ONLY valid JSON. No explanations.

[LEARNING_OUTCOMES]
${LO_LIST}

[SEGMENTS]
${SEGMENTS_JSON}

[SLIDE_HINTS (optional)]
${SLD || "—"}
`.trim();

  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  const result = await model.generateContent(prompt);
  const rawText = result.response.text() || "";
  const cleaned = stripCodeFences(rawText);
  const parsed = tryParseJSON(cleaned);

  if (!parsed?.segments || !Array.isArray(parsed.segments)) {
    throw new Error("LO alignment JSON parse/schema error");
  }

  const linksByIndex = new Map<number, LoLink[]>();

  for (const item of parsed.segments) {
    if (typeof item?.index !== "number" || !Array.isArray(item?.lo_links)) continue;
    const idx = item.index;
    const links: LoLink[] = [];
    for (const l of item.lo_links) {
      if (!l) continue;
      const lo_id = String(l.lo_id || "").trim();
      const lo_title = String(l.lo_title || "").trim();
      const conf = Number(l.confidence);
      if (!lo_id || !lo_title || !Number.isFinite(conf)) continue;
      links.push({
        lo_id,
        lo_title,
        confidence: Math.max(0, Math.min(1, conf)),
      });
    }
    linksByIndex.set(idx, links);
  }

  const segments: LoAlignedSegment[] = baseSegments.map((seg) => ({
    index: seg.index,
    text: seg.text,
    lo_links: linksByIndex.get(seg.index) || [],
  }));

  return { segments };
}

// Alignment-only generator (fallback / retry)
async function generateAlignmentOnly(
  genAI: GoogleGenerativeAI,
  lectureText: string,
  slidesText: string
) {
  const LEC = lectureText.slice(0, 18000);
  const SLD = slidesText.slice(0, 18000);

  const prompt = `
Compare the two texts and return ONLY the following JSON, nothing else.

SCHEMA:
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

RULES:
- "items" must contain at least 5 entries.
- For duration estimates, assume ~140 words per minute unless text gives hints.
- Output ONLY valid JSON.

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
  if (!j) throw new Error("Alignment JSON parse error");
  return j;
}

// ---- health check
app.get("/health", (_req, res) => res.json({ ok: true }));

/**
 * POST /api/plan-from-text
 * Body:
 *   {
 *     lectureText: string,
 *     slidesText: string,
 *     alignOnly?: boolean,
 *     prevPlan?: any,
 *     lessonId?: string,
 *     title?: string,
 *     courseCode?: string,
 *     learningOutcomes?: string[]
 *   }
 *
 * Output: { ok: true, plan, lessonId }
 */
/**
 * POST /api/plan-from-text
 * Body:
 *   {
 *     lectureText: string,
 *     slidesText: string,
 *     alignOnly?: boolean,
 *     prevPlan?: any,
 *     lessonId?: string,
 *     title?: string,
 *     courseCode?: string,
 *     learningOutcomes?: string[]
 *   }
 *
 * Output: { ok: true, plan, lessonId }
 */
app.post("/api/plan-from-text", async (req, res) => {
  try {
    const {
      lectureText,
      slidesText,
      alignOnly,
      prevPlan,
      lessonId,
      title,
      courseCode,
      learningOutcomes,
    } = req.body as {
      lectureText?: string;
      slidesText?: string;
      alignOnly?: boolean;
      prevPlan?: any;
      lessonId?: string;
      title?: string;
      courseCode?: string;
      learningOutcomes?: string[];
    };

    if (!lectureText || !slidesText) {
      return res
        .status(400)
        .json({ ok: false, error: "lectureText and slidesText are required" });
    }

    // LO’ları prompt’a sokmak için blok
    const LO_BLOCK =
      Array.isArray(learningOutcomes) && learningOutcomes.length
        ? learningOutcomes
          .map((lo, i) => `${i + 1}. ${String(lo || "").trim()}`)
          .join("\n")
        : "—";

    // ---------- ALIGNMENT ONLY MODU ----------
    if (alignOnly) {
      if (!prevPlan) {
        return res
          .status(400)
          .json({ ok: false, error: "prevPlan is required when alignOnly = true" });
      }

      const alignment = await generateAlignmentOnly(genAI, lectureText, slidesText);
      const plan = { ...prevPlan, alignment };

      const saved = upsertLesson({
        id: lessonId,
        title: title || prevPlan?.topic || "Lecture",
        transcript: lectureText,
        slideText: slidesText,
        plan,
        summary: plan?.summary,
        highlights: plan?.key_concepts || [],
        professorEmphases: plan?.emphases || [],
        courseCode,
        learningOutcomes,
      });

      return res.json({ ok: true, plan, lessonId: saved.id });
    }

    // ---------- TAM PLAN ÜRETİMİ ----------
    const LEC = lectureText.slice(0, 18000);
    const SLD = slidesText.slice(0, 18000);

    const prompt = `
You are an instructional designer. Analyze the following teacher speech transcript (LEC) and slide text (SLIDE) together.

PRIORITY:
- First, build a clear, practical learning plan (modules + lessons) that a student can follow.
- Then, extract teacher emphases from the lecture, and compare lecture vs slides (alignment).
- Focus on exam performance and understanding, not fluff.

IF OFFICIAL "LEARNING OUTCOMES" ARE PROVIDED:
- Align your plan with these learning outcomes.
- Write module and lesson goals so that they clearly serve these outcomes.
- But NEVER change the JSON schema below.

[COURSE CODE]
${courseCode || "—"}

[OFFICIAL LEARNING OUTCOMES]
${LO_BLOCK}

GOALS (DETAIL):
1) LEARNING PLAN ("modules"):
   - Organize content into 2–6 modules.
   - Each module has 1–6 lessons.
   - Each lesson has: clear objective, realistic study_time_min, concrete activities and a tiny mini_quiz.
   - Make it realistic for a university student: do not give impossible workloads.

2) TEACHER EMPHASES ("emphases"):
   - PRIMARY SIGNAL = spoken transcript (LEC).
   - Look for repetition, “this is important”, long explanations, examples, stories.
   - For each emphasis:
     - "statement": the distilled idea in your own words.
     - "why": why it matters for understanding or exams.
     - "source":
         "lecture"  → mainly from speech; slides only support it.
         "slides"   → mostly appears in slides; still important for learning outcomes.
         "both"     → clearly present and important in both LEC and SLIDE.
     - "from_transcript_quote": short direct quote from LEC (1–3 sentences max).
     - "from_slide_quote": short direct quote from SLIDE, or "" if not on slides.
     - "in_slides": true if the idea clearly appears on slides.
     - "related_lo_ids": e.g. ["LO2"] if you can map it; otherwise [].
     - "evidence": short justification in natural language.
   - Prefer fewer but strong emphases over many weak ones.

3) ALIGNMENT ("alignment"):
   - Items are medium-sized topics or concept clusters.
   - For each item:
     - "topic": short human-readable title.
     - "concepts": 3–8 bullet keywords.
     - "in_both": true if happens in both LEC and SLIDE.
     - "emphasis_level": "high" | "medium" | "low" according to TEACHER, not you.
     - "lecture_quotes": 1–3 short quotes from LEC.
     - "slide_refs": 1–3 short references or phrases from SLIDE.
     - "duration_min": how many minutes the teacher approximately spends there.
     - "confidence": 0–1.
   - Also fill "summary_chatty": a friendly 1–2 paragraph explanation of how the lecture and slides match.

OUTPUT: ONLY VALID JSON.

SCHEMA:
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
            {
              "type": "read|watch|practice|quiz|project",
              "prompt": "string",
              "expected_outcome": "string"
            }
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
      "source": "lecture" | "slides" | "both",
      "from_transcript_quote": "string",
      "from_slide_quote": "string | null",
      "related_lo_ids": string[]
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

RULES:
- Produce at least 5 items for "emphases" and at least 5 for "alignment.items".
- Prefer realistic, exam-oriented content over generic textbook summaries.
- For duration estimates, assume ~140 words per minute unless the text gives hints.
- Output ONLY JSON. Do NOT wrap it in code fences (\`\`\`).

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
      return res.status(500).json({
        ok: false,
        error: "LLM JSON parse error",
        llmText: cleaned.slice(0, 2000),
      });
    }

    // Alignment yoksa fallback
    if (!hasAlignment(plan)) {
      try {
        const alignment = await generateAlignmentOnly(genAI, lectureText, slidesText);
        plan = { ...plan, alignment };
      } catch (e) {
        console.warn("[Alignment fallback failed]:", (e as any)?.message || e);
      }
    }

    // average_duration_min eksikse hesapla
    if (!hasAlignment(plan) && plan?.alignment?.items?.length) {
      const items = plan.alignment.items;
      const valid = items.filter((x: any) => Number.isFinite(x?.duration_min));
      const avg =
        valid.reduce((a: number, b: any) => a + b.duration_min, 0) /
        Math.max(1, valid.length);
      plan.alignment.average_duration_min = Number.isFinite(avg)
        ? +avg.toFixed(1)
        : undefined;
    }

    const inferredTitle =
      title ||
      plan?.topic ||
      (plan?.modules?.[0]?.title ? `Lecture – ${plan.modules[0].title}` : "Lecture");

    const saved = upsertLesson({
      id: lessonId,
      title: inferredTitle,
      transcript: lectureText,
      slideText: slidesText,
      plan,
      summary: plan?.summary,
      highlights: plan?.key_concepts || [],
      professorEmphases: plan?.emphases || [],
      courseCode,
      learningOutcomes,
    });

    return res.json({ ok: true, plan, lessonId: saved.id });
  } catch (e: any) {
    console.error("[/api/plan-from-text ERROR]", e?.message || e);
    return res.status(500).json({ ok: false, error: e?.message || "server error" });
  }
});


/**
 * LO–Transcript alignment endpoint (text-only, no PDF/time yet)
 *
 * POST /api/lessons/:id/lo-align
 * Body (all optional; falls back to lesson data):
 *   {
 *     transcript?: string,
 *     slidesText?: string,
 *     learningOutcomes?: string[]
 *   }
 *
 * Output:
 *   { ok: true, loAlignment, lessonId }
 */
app.post("/api/lessons/:id/lo-align", async (req, res) => {
  try {
    const lessonId = req.params.id;
    const existing = getLesson(lessonId);
    if (!existing) {
      return res.status(404).json({ ok: false, error: "Lesson not found" });
    }

    const {
      transcript,
      slidesText,
      learningOutcomes,
    } = req.body as {
      transcript?: string;
      slidesText?: string;
      learningOutcomes?: string[];
    };

    const lecture = (transcript ?? existing.transcript ?? "").trim();
    const slides = slidesText ?? existing.slideText ?? "";
    const loList =
      (learningOutcomes && learningOutcomes.length
        ? learningOutcomes
        : existing.learningOutcomes) || [];

    if (!lecture) {
      return res
        .status(400)
        .json({ ok: false, error: "Transcript (lectureText) is required" });
    }
    if (!loList.length) {
      return res
        .status(400)
        .json({ ok: false, error: "Learning Outcomes list is required" });
    }

    const loAlignment = await generateLoAlignmentForLesson(
      genAI,
      lecture,
      slides,
      loList
    );

    const saved = upsertLesson({
      id: lessonId,
      transcript: lecture,
      slideText: slides,
      learningOutcomes: loList,
      loAlignment,
    });

    return res.json({ ok: true, loAlignment, lessonId: saved.id });
  } catch (e: any) {
    console.error("[/api/lessons/:id/lo-align ERROR]", e?.message || e);
    return res.status(500).json({ ok: false, error: e?.message || "server error" });
  }
});

/**
 * POST /api/quiz-from-plan
 * Body: { plan: any }
 * Output: { ok: true, questions: string[] }
 */
app.post("/api/quiz-from-plan", async (req, res) => {
  try {
    const { plan } = req.body as { plan?: any };
    if (!plan) {
      return res.status(400).json({ ok: false, error: "plan is required" });
    }

    const prompt = `
Generate 10 short quiz questions based on the plan below.
Return only the question sentences, one per line.

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

// Answer generation
app.post("/api/quiz-answers", async (req, res) => {
  try {
    const { questions, lectureText, slidesText, plan } = req.body as {
      questions?: string[];
      lectureText?: string;
      slidesText?: string;
      plan?: any;
    };
    if (!questions?.length || !lectureText || !slidesText) {
      return res.status(400).json({
        ok: false,
        error: "questions, lectureText, slidesText are required",
      });
    }

    const Q = questions.slice(0, 20);
    const LEC = lectureText.slice(0, 18000);
    const SLD = slidesText.slice(0, 18000);

    const prompt = `
Answer the questions with EVIDENCE. Return ONLY VALID JSON.

SCHEMA:
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

RULES:
- "short_answer": single concise line.
- "explanation": 1–3 sentences explaining why it is correct.
- "evidence": direct quotes from LEC and SLIDE; no hallucinations.
- If you are unsure, lower "confidence" and mention uncertainty in "explanation".

[LEC]
${LEC}

[SLIDE]
${SLD}

[PLAN (optional)]
${plan ? JSON.stringify(plan).slice(0, 6000) : "—"}

[QUESTIONS]
${Q.map((q, i) => `${i + 1}. ${q}`).join("\n")}
`.trim();

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const result = await model.generateContent(prompt);
    const cleaned = (result.response.text() || "")
      .replace(/```json?/gi, "")
      .replace(/```/g, "")
      .trim();
    const j = (() => {
      try {
        return JSON.parse(cleaned);
      } catch {
        return null;
      }
    })();

    if (!j?.answers)
      return res
        .status(500)
        .json({ ok: false, error: "JSON parse/schema error" });

    return res.json({ ok: true, answers: j.answers });
  } catch (e: any) {
    console.error("[/api/quiz-answers ERROR]", e?.message || e);
    return res.status(500).json({ ok: false, error: e?.message || "server error" });
  }
});

// Single-question evaluation
app.post("/api/quiz-eval", async (req, res) => {
  try {
    const { q, student_answer, lectureText, slidesText } = req.body as {
      q?: string;
      student_answer?: string;
      lectureText?: string;
      slidesText?: string;
    };
    if (!q || !student_answer || !lectureText || !slidesText) {
      return res.status(400).json({
        ok: false,
        error: "q, student_answer, lectureText, slidesText are required",
      });
    }

    const LEC = lectureText.slice(0, 14000);
    const SLD = slidesText.slice(0, 14000);

    const prompt = `
Act as an exam grader. Return ONLY VALID JSON.

SCHEMA:
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

RULES:
- First find evidence in LEC/SLIDE; then grade.
- "partial" if there is one or two key points missing.
- "feedback": short and constructive, 2–3 sentences.
- No hallucinated quotes; evidence must come from the texts.

[LEC]
${LEC}

[SLIDE]
${SLD}

[QUESTION]
${q}

[STUDENT_ANSWER]
${student_answer}
`.trim();

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const result = await model.generateContent(prompt);
    const cleaned = (result.response.text() || "")
      .replace(/```json?/gi, "")
      .replace(/```/g, "")
      .trim();
    const j = (() => {
      try {
        return JSON.parse(cleaned);
      } catch {
        return null;
      }
    })();

    if (!j?.grade)
      return res
        .status(500)
        .json({ ok: false, error: "JSON parse/schema error" });
    return res.json({ ok: true, ...j });
  } catch (e: any) {
    console.error("[/api/quiz-eval ERROR]", e?.message || e);
    return res.status(500).json({ ok: false, error: e?.message || "server error" });
  }
});

// ---- IEU LO helpers ----
function normalizeCourseCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "+");
}

function cleanHtmlText(raw: string): string {
  return raw
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extract Learning Outcomes text from IEU syllabus HTML.
 * Handles both bullet lists and LO1–LO7 table layouts.
 */
function extractLearningOutcomes(html: string): string[] {
  const out: string[] = [];

  const idx = html.indexOf("Learning Outcomes");
  if (idx === -1) return out;

  const slice = html.slice(idx, idx + 8000);

  // 1) <ul><li>... </li></ul> style
  const ulMatch = slice.match(/<ul[^>]*>([\s\S]*?)<\/ul>/i);
  if (ulMatch) {
    const liMatches = Array.from(
      ulMatch[1].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)
    );
    for (const m of liMatches) {
      const text = cleanHtmlText(m[1]);
      if (text) out.push(text);
    }
  }

  // 2) LO table style (LO1–LO7 rows)
  if (!out.length) {
    const rowMatches = Array.from(
      slice.matchAll(
        /<tr[^>]*>[\s\S]*?<td[^>]*>\s*LO\d+\s*<\/td>[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/gi
      )
    );
    for (const rm of rowMatches) {
      const text = cleanHtmlText(rm[1]);
      if (text) out.push(text);
    }
  }

  return out;
}
app.post("/api/lessons/:id/deviation", async (req, res) => {
  try {
    const lessonId = req.params.id;
    const lesson = getLesson(lessonId);
    if (!lesson) return res.status(404).json({ ok: false, error: "Lesson not found" });

    const transcript = String(lesson.transcript || "").trim();
    const slideText = String(lesson.slideText || "").trim();
    if (!transcript || !slideText) {
      return res.status(400).json({
        ok: false,
        error: "Transcript and slideText are required (upload audio + pdf first).",
      });
    }

    // cache: daha önce hesaplandıysa direkt dön (force=true ile atlanabilir)
    const forceReanalyze = req.query.force === 'true';
    if (!forceReanalyze && (lesson as any).deviation?.segments?.length) {
      return res.json({ ok: true, deviation: (lesson as any).deviation, cached: true });
    }

    const tmpDir = path.join(os.tmpdir(), "learncraft_deviation");
    fs.mkdirSync(tmpDir, { recursive: true });

    const trPath = path.join(tmpDir, `${lessonId}.transcript.txt`);
    const slPath = path.join(tmpDir, `${lessonId}.slides.txt`);

    fs.writeFileSync(trPath, transcript, "utf-8");
    fs.writeFileSync(slPath, slideText, "utf-8");

    // Fix path: check if we are already in backend dir or root
    let pyPath = path.join(process.cwd(), "backend", "transcribe", "deviation.py");
    if (!fs.existsSync(pyPath)) {
      // try without "backend" prefix (if running from backend dir)
      pyPath = path.join(process.cwd(), "transcribe", "deviation.py");
    }
    const pythonBin = process.env.PYTHON_BIN || "python";

    console.log(`[Deviation] Running: ${pythonBin} ${pyPath}`);
    console.log(`[Deviation] TrPath: ${trPath}`);
    console.log(`[Deviation] SlPath: ${slPath}`);
    console.log(`[Deviation] Title: ${lesson.title || "Untitled"}`);

    const proc = spawn(pythonBin, [
      pyPath,
      "--transcript", trPath,
      "--slides", slPath,
      "--title", lesson.title || "Untitled Lesson"
    ], {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let out = "";
    let err = "";

    proc.stdout.on("data", (data) => (out += data.toString()));
    proc.stderr.on("data", (data) => (err += data.toString()));

    proc.on("close", (code) => {
      // temp cleanup
      try { fs.unlinkSync(trPath); } catch { }
      try { fs.unlinkSync(slPath); } catch { }

      if (code !== 0) {
        console.error(`[Deviation] Script failed with code ${code}`);
        console.error(`[Deviation] Stderr: ${err}`);
        console.error(`[Deviation] Stdout: ${out}`);
        return res.status(500).json({
          ok: false,
          error: `Deviation script failed: ${(err || out || "Unknown error").slice(0, 500)}`,
          details: (err || out || "")
        });
      }

      let result: any;
      try {
        result = JSON.parse(out);
      } catch (e) {
        console.error("[Deviation] JSON parse error:", e);
        console.error("[Deviation] Output was:", out);
        return res.status(500).json({ ok: false, error: "Failed to parse script output" });
      }

      if (!result?.ok) {
        return res.status(500).json({ ok: false, error: result?.error || "Script returned error" });
      }

      // Save using upsertLesson
      const saved = upsertLesson({ id: lessonId, deviation: result } as any);
      return res.json({ ok: true, lessonId: saved.id, deviation: result });
    });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || "server error" });
  }
});

app.get("/api/ieu/learning-outcomes", async (req, res) => {
  try {
    const rawCode = String(req.query.code || "").trim();
    if (!rawCode) {
      return res
        .status(400)
        .json({ ok: false, error: "code param is required (e.g. MATH 153)" });
    }

    const code = normalizeCourseCode(rawCode);
    const url = `https://se.ieu.edu.tr/en/syllabus_v2/type/read/id/${encodeURIComponent(
      code
    )}`;

    const r = await fetch(url);
    if (!r.ok) {
      return res.status(404).json({
        ok: false,
        error: `Syllabus not found or unreachable for ${code}`,
        status: r.status,
      });
    }

    const html = await r.text();
    const learningOutcomes = extractLearningOutcomes(html);

    if (!learningOutcomes.length) {
      return res.status(200).json({
        ok: false,
        error: "Learning Outcomes section not found or could not be parsed.",
        url,
      });
    }

    return res.json({
      ok: true,
      code,
      url,
      learningOutcomes,
    });
  } catch (err: any) {
    console.error("[/api/ieu/learning-outcomes] Error:", err);
    return res.status(500).json({
      ok: false,
      error: err?.message || "Unknown error",
    });
  }
});

// 🧠 Deep Dive Chat API - Enhanced with suggestions
app.post("/api/lessons/:id/chat", async (req, res) => {
  try {
    const lessonId = req.params.id;
    const { message, history } = req.body;
    const lesson = getLesson(lessonId);
    if (!lesson) return res.status(404).json({ error: "Lesson not found" });

    const plan = lesson.plan as any;
    const modules = plan?.modules || [];
    const emphases = lesson.professorEmphases || plan?.emphases || [];

    // Enhanced context with more data
    const context = `
=== LESSON INFORMATION ===
Title: ${lesson.title || "Untitled Lesson"}

=== KEY TOPICS (from modules) ===
${modules.slice(0, 5).map((m: any, i: number) => `${i + 1}. ${m.title || m.name || 'Topic'}`).join('\n')}

=== PROFESSOR EMPHASES ===
${emphases.slice(0, 5).map((e: any) => `• ${e.statement || e}`).join('\n') || 'None'}

=== TRANSCRIPT EXCERPT ===
${(lesson.transcript || "").slice(0, 4000)}

=== SLIDE CONTENT EXCERPT ===
${(lesson.slideText || "").slice(0, 3000)}
`;

    const chat = model.startChat({
      history: history?.map((h: any) => ({
        role: h.role === 'user' ? 'user' : 'model',
        parts: [{ text: h.content }]
      })) || [],
    });

    const prompt = `
You are an ELITE AI TUTOR for this university lesson. You help students understand concepts deeply.

=== YOUR PERSONALITY ===
- Friendly but professional 🎓
- Uses analogies and examples
- Encourages curiosity
- Celebrates when student understands

=== LESSON CONTEXT ===
${context}

=== FORMATTING RULES ===
- Use **bold** for key terms
- Use bullet points for lists
- Use \`code\` for technical terms
- Keep paragraphs short (2-3 sentences max)
- Include relevant emojis sparingly

=== RESPONSE FORMAT ===
Answer the student's question thoroughly but concisely.
At the END of your response, add this EXACT format:

---
💡 **Önerilen Sorular:**
1. [First suggested follow-up question in Turkish]
2. [Second suggested follow-up question in Turkish]
3. [Third suggested follow-up question in Turkish]

The suggested questions should be:
- Related to the current topic
- Progressively deeper or exploring related concepts
- Written in Turkish

=== STUDENT QUESTION ===
${message}
`;

    const result = await chat.sendMessage(prompt);
    let text = result.response.text();

    // Parse suggestions from response
    const suggestionsMatch = text.match(/💡\s*\*\*Önerilen Sorular:\*\*\s*([\s\S]*?)$/);
    let suggestions: string[] = [];

    if (suggestionsMatch) {
      const suggestionLines = suggestionsMatch[1].trim().split('\n');
      suggestions = suggestionLines
        .map(line => line.replace(/^\d+\.\s*/, '').trim())
        .filter(s => s.length > 5)
        .slice(0, 3);
    }

    return res.json({ ok: true, text, suggestions });
  } catch (e: any) {
    console.error("Chat error:", e);
    return res.status(500).json({ ok: false, error: e.message });
  }
});

// 🗺️ Mind Map API
app.post("/api/lessons/:id/mindmap", async (req, res) => {
  try {
    const lessonId = req.params.id;
    const lesson = getLesson(lessonId);
    if (!lesson || !lesson.plan) return res.status(404).json({ error: "Plan not found" });

    // Extract useful data from lesson
    const plan = lesson.plan as any;
    const title = lesson.title || plan.title || "Lesson Topic";
    const modules = plan.modules || [];
    const emphases = lesson.professorEmphases || plan.emphases || [];
    const highlights = lesson.highlights || [];

    // Get transcript and slides excerpts
    const transcript = (lesson.transcript || "").substring(0, 2000);
    const slides = (lesson.slideText || "").substring(0, 1500);

    // Build content summary for AI
    const moduleNames = modules.slice(0, 4).map((m: any) => m.title || m.name || "Module");
    const keyPoints = emphases.slice(0, 6).map((e: any) => e.statement || e).filter(Boolean);
    const concepts = highlights.slice(0, 8);

    console.log("[Mindmap v2-Rich+] Building for:", {
      title,
      moduleNames,
      keyPoints: keyPoints.length,
      concepts: concepts.length,
      transcriptLen: transcript.length,
      slidesLen: slides.length
    });

    // EDUCATIONAL STUDY GUIDE PROMPT - Optimized for learning
    const prompt = `
You are a MASTER EDUCATOR creating a STUDY GUIDE mindmap.
This mindmap should help a student:
1. Understand the topic quickly
2. Prepare for exams
3. Remember key concepts

=== MERMAID SYNTAX (STRICT) ===
- Start with: mindmap
- Root: root((📚 Topic Name))
- Use 2-space indentation
- NO special chars: no [], (), {}, :, backticks, quotes
- Labels: MAX 18 chars, keywords only

=== EDUCATIONAL STRUCTURE (5 BRANCHES) ===
📚 TOPIC (root)
├── ❓ What - Definition and meaning
├── 🎯 Why - Purpose and benefits  
├── ⚡ How - Implementation steps
├── 💡 Practice - Examples to try
└── 📝 Remember - Key exam points

=== CONTENT GUIDELINES ===
For WHAT branch:
- Simple definition in 2-3 words
- Core meaning
- What it does

For WHY branch:
- Main benefits
- Why we use it
- Problem it solves

For HOW branch:
- Step by step
- Syntax or structure
- Key components

For PRACTICE branch:
- Simple example
- Try this exercise
- Common use case

For REMEMBER branch:
- Exam tip
- Common mistake
- Important rule

=== LABEL RULES ===
- Use student-friendly language
- Action-oriented: Learn, Use, Try, Remember
- Start branches with verbs when possible
- Max 4 items per branch

=== LESSON DATA ===
Topic: ${title}
Sections: ${moduleNames.join(", ") || "Introduction, Main Content, Practice"}
Key points: ${keyPoints.slice(0, 4).join(" | ") || "Important concepts"}
Terms: ${concepts.slice(0, 6).join(", ") || "vocabulary"}

=== LECTURE CONTENT ===
${transcript.substring(0, 1000) || "No transcript"}

=== SLIDE CONTENT ===
${slides.substring(0, 800) || "No slides"}

=== EXAMPLE (FOLLOW THIS PATTERN) ===
mindmap
  root((📚 Python Functions))
    ❓ What
      Reusable code
      Named block
      Does one task
    🎯 Why
      Avoid repetition
      Clean code
      Easy to debug
    ⚡ How
      Use def keyword
      Add parameters
      Return result
    💡 Practice
      Hello function
      Add two numbers
      List processor
    📝 Remember
      One task only
      Use good names
      Always test it

=== YOUR TASK ===
Create a STUDY GUIDE mindmap for "${title}".
Make it helpful for exam preparation.
OUTPUT ONLY the mermaid code, nothing else.
`;

    const result = await model.generateContent(prompt);
    let code = result.response.text();

    // ULTRA-AGGRESSIVE SANITIZATION to prevent syntax errors
    code = code
      .replace(/```mermaid/gi, "")
      .replace(/```/g, "")
      .replace(/\r\n/g, "\n")
      .trim();

    // Process line by line
    const lines = code.split("\n");
    const cleanLines: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];
      const trimmed = line.trim();

      // Skip empty lines at the start
      if (!trimmed && cleanLines.length < 2) continue;
      // Skip code fence remnants
      if (trimmed.includes('```')) continue;
      // Skip lines that are just punctuation
      if (/^[:\-\[\]\(\)\{\}]+$/.test(trimmed)) continue;

      // For non-root lines, sanitize special chars that break Mermaid
      if (!trimmed.startsWith('mindmap') && !trimmed.startsWith('root((')) {
        // Remove problematic chars from label content
        line = line.replace(/[:\[\]\{\}`"]/g, "");
        // Fix parentheses that aren't part of root(())
        if (!line.includes('root((')) {
          line = line.replace(/\(/g, "").replace(/\)/g, "");
        }
        // Limit line length (very long labels can cause issues)
        if (line.trim().length > 50) {
          const indent = line.match(/^\s*/)?.[0] || "";
          line = indent + line.trim().substring(0, 50);
        }
      }

      if (line.trim()) {
        cleanLines.push(line);
      }
    }

    // Ensure starts with mindmap
    if (!cleanLines[0]?.trim().startsWith('mindmap')) {
      cleanLines.unshift('mindmap');
    }

    // Validate we have at least root node
    const hasRoot = cleanLines.some(l => l.includes('root(('));
    if (!hasRoot && cleanLines.length > 1) {
      cleanLines.splice(1, 0, '  root((📚 ' + (title || 'Topic').substring(0, 15) + '))');
    }

    code = cleanLines.join("\n");

    console.log("[Mindmap] Generated code:", code.substring(0, 400));

    return res.json({ ok: true, code });
  } catch (e: any) {
    console.error("Mindmap error:", e);
    return res.status(500).json({ ok: false, error: e.message });
  }
});

// 📋 Get lesson modules list for multi-map feature
app.get("/api/lessons/:id/modules", (req, res) => {
  try {
    const lessonId = req.params.id;
    const lesson = getLesson(lessonId);
    if (!lesson || !lesson.plan) return res.status(404).json({ error: "Lesson not found" });

    const plan = lesson.plan as any;
    const modules = plan.modules || [];

    // Extract module info
    const moduleList = modules.map((m: any, index: number) => ({
      id: index,
      title: m.title || m.name || `Module ${index + 1}`,
      topics: (m.topics || m.content || []).slice(0, 5).map((t: any) =>
        typeof t === 'string' ? t : (t.title || t.name || 'Topic')
      )
    }));

    // Add "All Modules" option
    const allModulesOption = {
      id: -1,
      title: "📚 Tüm Modüller (Genel Bakış)",
      topics: moduleList.slice(0, 4).map((m: any) => m.title)
    };

    return res.json({
      ok: true,
      lessonTitle: lesson.title || "Lesson",
      modules: [allModulesOption, ...moduleList]
    });
  } catch (e: any) {
    console.error("Modules list error:", e);
    return res.status(500).json({ ok: false, error: e.message });
  }
});

// 🗺️ Generate mindmap for specific module
app.post("/api/lessons/:id/mindmap/module", async (req, res) => {
  try {
    const lessonId = req.params.id;
    const moduleIndex = req.body.moduleIndex ?? -1; // -1 = all modules

    const lesson = getLesson(lessonId);
    if (!lesson || !lesson.plan) return res.status(404).json({ error: "Plan not found" });

    const plan = lesson.plan as any;
    const modules = plan.modules || [];
    const lessonTitle = lesson.title || plan.title || "Lesson Topic";

    let targetTitle: string;
    let targetContent: string;

    if (moduleIndex === -1) {
      // All modules - overview
      targetTitle = lessonTitle;
      targetContent = modules.slice(0, 4).map((m: any) => {
        const title = m.title || m.name || "Module";
        const topics = (m.topics || m.content || []).slice(0, 3).map((t: any) =>
          typeof t === 'string' ? t : (t.title || '')
        ).join(", ");
        return `${title}: ${topics}`;
      }).join("\n");
    } else {
      // Specific module
      const targetModule = modules[moduleIndex];
      if (!targetModule) return res.status(404).json({ error: "Module not found" });

      targetTitle = targetModule.title || targetModule.name || `Module ${moduleIndex + 1}`;
      const topics = targetModule.topics || targetModule.content || [];
      targetContent = topics.map((t: any) =>
        typeof t === 'string' ? t : (t.title || t.name || t.description || '')
      ).join("\n");
    }

    console.log("[Mindmap Module] Building for:", { targetTitle, moduleIndex, contentLen: targetContent.length });

    const prompt = `
You are a MASTER EDUCATOR creating a STUDY GUIDE mindmap for a specific module.

=== MERMAID SYNTAX (STRICT) ===
- Start with: mindmap
- Root: root((📚 Topic Name))
- Use 2-space indentation
- NO special chars: no [], (), {}, :, backticks, quotes
- Labels: MAX 18 chars

=== STRUCTURE (5 BRANCHES) ===
📚 TOPIC
├── ❓ What - Definition
├── 🎯 Why - Purpose  
├── ⚡ How - Steps
├── 💡 Practice - Examples
└── 📝 Remember - Key points

=== MODULE DATA ===
Module Title: ${targetTitle}
Module Content: ${targetContent.substring(0, 1000)}

=== EXAMPLE ===
mindmap
  root((📚 ${targetTitle.substring(0, 15)}))
    ❓ What
      Definition
      Core concept
    🎯 Why
      Main benefit
      Purpose
    ⚡ How
      Step one
      Step two
    💡 Practice
      Simple example
    📝 Remember
      Key point

=== OUTPUT ===
Create mindmap for "${targetTitle}". OUTPUT ONLY mermaid code.
`;

    const result = await model.generateContent(prompt);
    let code = result.response.text();

    // Sanitization (same as main mindmap)
    code = code.replace(/```mermaid/gi, "").replace(/```/g, "").replace(/\r\n/g, "\n").trim();

    const lines = code.split("\n");
    const cleanLines: string[] = [];

    for (const line of lines) {
      let processedLine = line;
      const trimmed = line.trim();

      if (!trimmed && cleanLines.length < 2) continue;
      if (trimmed.includes('```')) continue;
      if (/^[:\-\[\]\(\)\{\}]+$/.test(trimmed)) continue;

      if (!trimmed.startsWith('mindmap') && !trimmed.startsWith('root((')) {
        processedLine = processedLine.replace(/[:\[\]\{\}`"]/g, "");
        if (!processedLine.includes('root((')) {
          processedLine = processedLine.replace(/\(/g, "").replace(/\)/g, "");
        }
        if (processedLine.trim().length > 50) {
          const indent = processedLine.match(/^\s*/)?.[0] || "";
          processedLine = indent + processedLine.trim().substring(0, 50);
        }
      }

      if (processedLine.trim()) cleanLines.push(processedLine);
    }

    if (!cleanLines[0]?.trim().startsWith('mindmap')) cleanLines.unshift('mindmap');

    const hasRoot = cleanLines.some(l => l.includes('root(('));
    if (!hasRoot) {
      cleanLines.splice(1, 0, '  root((📚 ' + targetTitle.substring(0, 15) + '))');
    }

    code = cleanLines.join("\n");
    console.log("[Mindmap Module] Generated:", code.substring(0, 300));

    return res.json({ ok: true, code, moduleTitle: targetTitle });
  } catch (e: any) {
    console.error("Module mindmap error:", e);
    return res.status(500).json({ ok: false, error: e.message });
  }
});

// 🧠 Mindmap Node Detail API - AI-powered explanations for clicked nodes
app.post("/api/lessons/:id/mindmap/node-detail", async (req, res) => {
  try {
    const lessonId = req.params.id;
    const { nodeName, action } = req.body as { nodeName: string; action: "explain" | "example" | "quiz" };

    if (!nodeName || !action) {
      return res.status(400).json({ ok: false, error: "nodeName and action are required" });
    }

    const lesson = getLesson(lessonId);
    if (!lesson) return res.status(404).json({ ok: false, error: "Lesson not found" });

    const plan = lesson.plan as any;
    const transcript = (lesson.transcript || "").substring(0, 3000);
    const slides = (lesson.slideText || "").substring(0, 2000);
    const lessonTitle = lesson.title || "Lesson";

    let prompt = "";

    if (action === "explain") {
      prompt = `
You are an expert tutor. Explain the concept "${nodeName}" from the lesson "${lessonTitle}".

=== LESSON CONTEXT ===
${transcript.substring(0, 1500)}

${slides.substring(0, 1000)}

=== INSTRUCTIONS ===
1. Give a clear, concise explanation (2-3 paragraphs max)
2. Use simple language a student can understand
3. Highlight key points with **bold**
4. Include relevant emoji sparingly

=== OUTPUT FORMAT ===
Return ONLY valid JSON:
{
  "title": "${nodeName}",
  "explanation": "Your explanation here...",
  "keyPoints": ["point 1", "point 2", "point 3"],
  "relatedConcepts": ["concept 1", "concept 2"]
}
`;
    } else if (action === "example") {
      prompt = `
You are an expert tutor. Give a real-world example for the concept "${nodeName}" from the lesson "${lessonTitle}".

=== LESSON CONTEXT ===
${transcript.substring(0, 1500)}

=== INSTRUCTIONS ===
1. Give a concrete, relatable example
2. Connect it to everyday life if possible
3. Explain step by step how the concept applies
4. Keep it simple and memorable

=== OUTPUT FORMAT ===
Return ONLY valid JSON:
{
  "title": "${nodeName}",
  "example": {
    "scenario": "The real-world situation...",
    "explanation": "How this concept applies...",
    "takeaway": "What to remember..."
  }
}
`;
    } else if (action === "quiz") {
      prompt = `
You are an exam creator. Create a quiz question about "${nodeName}" from the lesson "${lessonTitle}".

=== LESSON CONTEXT ===
${transcript.substring(0, 1500)}

=== INSTRUCTIONS ===
1. Create a multiple choice question (4 options)
2. Make it test understanding, not just memorization
3. Include a brief explanation for the correct answer

=== OUTPUT FORMAT ===
Return ONLY valid JSON:
{
  "title": "${nodeName}",
  "quiz": {
    "question": "Your question here?",
    "options": ["A) Option 1", "B) Option 2", "C) Option 3", "D) Option 4"],
    "correctAnswer": "A",
    "explanation": "Why this is correct..."
  }
}
`;
    }

    const result = await model.generateContent(prompt);
    let responseText = result.response.text();

    // Clean and parse JSON
    responseText = responseText
      .replace(/```json?/gi, "")
      .replace(/```/g, "")
      .trim();

    let parsed;
    try {
      parsed = JSON.parse(responseText);
    } catch (e) {
      console.error("[Node Detail] JSON parse error:", e);
      console.error("[Node Detail] Response was:", responseText.substring(0, 500));
      return res.status(500).json({ ok: false, error: "Failed to parse AI response" });
    }

    return res.json({ ok: true, action, ...parsed });
  } catch (e: any) {
    console.error("[Node Detail] Error:", e);
    return res.status(500).json({ ok: false, error: e.message });
  }
});

// ---- Lessons & Memory API ----
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
// 🗑️ Delete lesson
app.delete("/api/lessons/:id", (req, res) => {
  const id = req.params.id;
  const success = deleteLesson(id);
  if (!success) return res.status(404).json({ ok: false, error: "Not found" });
  return res.json({ ok: true, deleted: id });
});
app.get("/api/memory", (_req, res) => res.json(getMemory()));

// 🎯 Quiz API (linked to lessonId)
app.post("/api/quiz/generate", (req, res) => {
  const { count, lessonIds, lessonId } = req.body as {
    count?: number;
    lessonIds?: string[];
    lessonId?: string;
  };

  const pack = generateQuizFromEmphases(count ?? 5, lessonIds);

  if (!isQuizPack(pack)) {
    return res.status(400).json(pack);
  }

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
  if (lessonId && typeof result?.score === "number")
    setQuizScore(lessonId, req.params.packId, result.score);
  res.json(result);
});

// ---- server ----
const PORT = Number(process.env.PORT || 4000);
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Backend running at http://localhost:${PORT}`);
});
