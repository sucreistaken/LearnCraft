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

// ✅ Single source of truth for lessons & quiz relations
import {
  // lesson based
  listLessons,
  getLesson,
  upsertLesson,
  updateProgress,
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
app.use(cors());
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
 */
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
test scores. Remove anything that is not helping understanding or exam performance.

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
 */
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
