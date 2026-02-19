import { Router } from "express";
import path from "path";
import os from "os";
import fs from "fs";
import { spawn } from "child_process";
import {
  listLessons,
  getLesson,
  upsertLesson,
  updateProgress,
  deleteLesson,
  getMemory,
} from "../controllers/lessonControllers";
import {
  assembleCourseContext,
} from "../controllers/contextAssembler";
import {
  getCourseForLesson,
  rebuildKnowledgeIndex,
} from "../controllers/courseController";
import { getModel, stripCodeFences, tryParseJSON } from "../services/aiService";
import { LoLink, LoAlignedSegment, LoAlignment } from "../types";
import { buildCheatSheetPrompt } from "../services/cheatSheetService";
import {
  buildCondensedContext,
  segmentTranscript,
  hasAlignment,
  buildLoModulesPrompt,
  generateLoAlignmentForLesson,
  generateAlignmentOnly,
} from "../services/loModuleService";

const router = Router();

// ---- IEU LO helpers ----
function normalizeCourseCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "+");
}

function cleanHtmlText(raw: string): string {
  return raw.replace(/<br\s*\/?>/gi, " ").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

function extractLearningOutcomes(html: string): string[] {
  const out: string[] = [];
  const idx = html.indexOf("Learning Outcomes");
  if (idx === -1) return out;
  const slice = html.slice(idx, idx + 8000);
  const ulMatch = slice.match(/<ul[^>]*>([\s\S]*?)<\/ul>/i);
  if (ulMatch) {
    const liMatches = Array.from(ulMatch[1].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi));
    for (const m of liMatches) { const text = cleanHtmlText(m[1]); if (text) out.push(text); }
  }
  if (!out.length) {
    const rowMatches = Array.from(slice.matchAll(/<tr[^>]*>[\s\S]*?<td[^>]*>\s*LO\d+\s*<\/td>[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/gi));
    for (const rm of rowMatches) { const text = cleanHtmlText(rm[1]); if (text) out.push(text); }
  }
  return out;
}

declare const fetch: any;

// =============== ROUTES ===============

// ---- Lesson CRUD ----
router.get("/lessons", (_req, res) => res.json(listLessons()));
router.get("/lessons/:id", (req, res) => {
  const l = getLesson(req.params.id);
  if (!l) return res.status(404).json({ error: "Not found" });
  res.json(l);
});
router.post("/lessons", (req, res) => {
  const l = upsertLesson(req.body);
  res.json(l);
});
router.patch("/lessons/:id/progress", (req, res) => {
  const l = updateProgress(req.params.id, req.body);
  if (!l) return res.status(404).json({ error: "Not found" });
  res.json(l);
});
router.delete("/lessons/:id", (req, res) => {
  const id = req.params.id;
  const success = deleteLesson(id);
  if (!success) return res.status(404).json({ ok: false, error: "Not found" });
  return res.json({ ok: true, deleted: id });
});
router.get("/memory", (_req, res) => res.json(getMemory()));

// ---- Cheat Sheet ----
router.post("/lessons/:id/cheat-sheet", async (req, res) => {
  try {
    const lessonId = req.params.id;
    const { language = 'tr', courseWide = false } = req.body as { language?: 'tr' | 'en'; courseWide?: boolean };
    const lesson = getLesson(lessonId);
    if (!lesson) return res.status(404).json({ ok: false, error: "Lesson not found" });

    const forceRegen = req.query.force === 'true';
    if (!forceRegen && !courseWide && lesson.cheatSheet?.sections?.length && (lesson.cheatSheet as any).language === language) {
      return res.json({ ok: true, lessonId, cheatSheet: lesson.cheatSheet, cached: true });
    }

    const title = lesson.title || "Lesson";
    const transcript = (lesson.transcript || "").trim();
    const slideText = lesson.slideText || "";
    if (!transcript && !slideText) {
      return res.status(400).json({ ok: false, error: "Transcript or slideText is required." });
    }

    const courseCtx = assembleCourseContext(lessonId, "cheat-sheet");
    const { lecContext, sldContext } = buildCondensedContext(lesson);
    let enrichedLecContext = lecContext;
    if (courseCtx.crossLessonBlock) {
      enrichedLecContext += `\n\n--- Related Lessons ---\n${courseCtx.crossLessonBlock}`;
    }

    const prompt = buildCheatSheetPrompt({
      title: courseCtx.courseName ? `${courseCtx.courseName} - ${title}` : title,
      transcript: enrichedLecContext, slideText: sldContext,
      learningOutcomes: lesson.learningOutcomes || [],
      emphases: lesson.plan?.emphases || lesson.professorEmphases || [],
      language,
    });

    const result = await getModel().generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 3000 },
    });
    const raw = (result.response.text() || "").trim();
    const cleaned = stripCodeFences(raw);
    const j = tryParseJSON(cleaned);
    if (!j?.sections || !Array.isArray(j.sections)) {
      return res.status(500).json({ ok: false, error: "Cheat sheet JSON/schema error" });
    }

    const cheatSheet = {
      title: j.title || title, updatedAt: new Date().toISOString(),
      sections: j.sections, formulas: Array.isArray(j.formulas) ? j.formulas : [],
      pitfalls: Array.isArray(j.pitfalls) ? j.pitfalls : [],
      quickQuiz: Array.isArray(j.quickQuiz) ? j.quickQuiz : [],
      language,
    };
    const saved = upsertLesson({ id: lessonId, cheatSheet });
    return res.json({ ok: true, lessonId: saved.id, cheatSheet });
  } catch (e: any) {
    console.error("[/api/lessons/:id/cheat-sheet ERROR]", e?.message || e);
    return res.status(500).json({ ok: false, error: e?.message || "server error" });
  }
});

// ---- LO Modules ----
router.post("/lessons/:id/lo-modules", async (req, res) => {
  try {
    const lessonId = req.params.id;
    const lesson = getLesson(lessonId);
    if (!lesson) return res.status(404).json({ ok: false, error: "Lesson not found" });
    const forceRegen = req.query.force === 'true';
    if (!forceRegen && lesson.loModules?.modules?.length) {
      return res.json({ ok: true, modules: lesson.loModules.modules, lessonId, cached: true });
    }
    const { transcript, slideText, learningOutcomes, loAlignment, plan } = lesson;
    if (!transcript || !learningOutcomes?.length) {
      return res.status(400).json({ ok: false, error: "Transcript and Learning Outcomes are required." });
    }
    const prompt = buildLoModulesPrompt({ transcript, slideText: slideText || "", learningOutcomes, loAlignment, plan });
    const result = await getModel().generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 6000 },
    });
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

// ---- LO Align ----
router.post("/lessons/:id/lo-align", async (req, res) => {
  try {
    const lessonId = req.params.id;
    const existing = getLesson(lessonId);
    if (!existing) return res.status(404).json({ ok: false, error: "Lesson not found" });
    const forceRegen = req.query.force === 'true';
    if (!forceRegen && existing.loAlignment?.segments?.length) {
      return res.json({ ok: true, loAlignment: existing.loAlignment, lessonId, cached: true });
    }
    const { transcript, slidesText, learningOutcomes } = req.body as {
      transcript?: string; slidesText?: string; learningOutcomes?: string[];
    };
    const lecture = (transcript ?? existing.transcript ?? "").trim();
    const slides = slidesText ?? existing.slideText ?? "";
    const loList = (learningOutcomes?.length ? learningOutcomes : existing.learningOutcomes) || [];
    if (!lecture) return res.status(400).json({ ok: false, error: "Transcript is required" });
    if (!loList.length) return res.status(400).json({ ok: false, error: "Learning Outcomes list is required" });

    const loAlignment = await generateLoAlignmentForLesson(lecture, slides, loList);
    const saved = upsertLesson({ id: lessonId, transcript: lecture, slideText: slides, learningOutcomes: loList, loAlignment });
    return res.json({ ok: true, loAlignment, lessonId: saved.id });
  } catch (e: any) {
    console.error("[/api/lessons/:id/lo-align ERROR]", e?.message || e);
    return res.status(500).json({ ok: false, error: e?.message || "server error" });
  }
});

// ---- Plan from Text ----
router.post("/plan-from-text", async (req, res) => {
  try {
    const { lectureText, slidesText, alignOnly, prevPlan, lessonId, title, courseCode, learningOutcomes } = req.body as {
      lectureText?: string; slidesText?: string; alignOnly?: boolean; prevPlan?: any;
      lessonId?: string; title?: string; courseCode?: string; learningOutcomes?: string[];
    };
    if (!lectureText || !slidesText) {
      return res.status(400).json({ ok: false, error: "lectureText and slidesText are required" });
    }

    const LO_BLOCK = Array.isArray(learningOutcomes) && learningOutcomes.length
      ? learningOutcomes.map((lo, i) => `${i + 1}. ${String(lo || "").trim()}`).join("\n")
      : "—";

    if (alignOnly) {
      if (!prevPlan) return res.status(400).json({ ok: false, error: "prevPlan is required when alignOnly = true" });
      const alignment = await generateAlignmentOnly(lectureText, slidesText);
      const plan = { ...prevPlan, alignment };
      const saved = upsertLesson({
        id: lessonId, title: title || prevPlan?.topic || "Lecture",
        transcript: lectureText, slideText: slidesText, plan,
        summary: plan?.summary, highlights: plan?.key_concepts || [],
        professorEmphases: plan?.emphases || [], courseCode, learningOutcomes,
      });
      return res.json({ ok: true, plan, lessonId: saved.id });
    }

    const LEC = lectureText.slice(0, 18000);
    const SLD = slidesText.slice(0, 18000);

    const prompt = `
You are an instructional designer. Analyze the following teacher speech transcript (LEC) and slide text (SLIDE) together.

PRIORITY:
- First, build a clear, practical learning plan (modules + lessons) that a student can follow.
- Then, extract teacher emphases from the lecture, and compare lecture vs slides (alignment).

IF OFFICIAL "LEARNING OUTCOMES" ARE PROVIDED:
- Align your plan with these learning outcomes.

[COURSE CODE]
${courseCode || "—"}

[OFFICIAL LEARNING OUTCOMES]
${LO_BLOCK}

GOALS:
1) LEARNING PLAN ("modules"): 2–6 modules, each with 1–6 lessons.
2) TEACHER EMPHASES ("emphases"): From transcript repetition, explanations, examples.
3) ALIGNMENT ("alignment"): Topics in both LEC and SLIDE.

OUTPUT: ONLY VALID JSON.
SCHEMA:
{
  "topic": "string", "key_concepts": string[], "duration_weeks": number,
  "modules": [{ "title": "string", "goal": "string", "lessons": [{ "title": "string", "objective": "string", "study_time_min": number, "activities": [{ "type": "read|watch|practice|quiz|project", "prompt": "string", "expected_outcome": "string" }], "mini_quiz": string[] }] }],
  "resources": string[],
  "emphases": [{ "statement": "string", "why": "string", "in_slides": boolean, "evidence": "string", "source": "lecture"|"slides"|"both", "from_transcript_quote": "string", "from_slide_quote": "string|null", "related_lo_ids": string[] }],
  "seed_quiz": string[],
  "alignment": { "summary_chatty": "string", "average_duration_min": number, "items": [{ "topic": "string", "concepts": string[], "in_both": boolean, "emphasis_level": "high"|"medium"|"low", "lecture_quotes": string[], "slide_refs": string[], "duration_min": number, "confidence": number }] }
}

RULES:
- At least 5 emphases and 5 alignment items.
- Output ONLY JSON.

[LEC]
${LEC}

[SLIDE]
${SLD}
`.trim();

    const result = await getModel().generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 8000 },
    });
    const rawText = result.response.text() || "";
    const cleaned = stripCodeFences(rawText);
    let plan = tryParseJSON(cleaned);
    if (!plan) {
      console.error("[Parse FAIL]:", cleaned.slice(0, 2000));
      return res.status(500).json({ ok: false, error: "LLM JSON parse error", llmText: cleaned.slice(0, 2000) });
    }
    if (!hasAlignment(plan)) {
      try { const alignment = await generateAlignmentOnly(lectureText, slidesText); plan = { ...plan, alignment }; }
      catch (e) { console.warn("[Alignment fallback failed]:", (e as any)?.message || e); }
    }
    if (!hasAlignment(plan) && plan?.alignment?.items?.length) {
      const items = plan.alignment.items;
      const valid = items.filter((x: any) => Number.isFinite(x?.duration_min));
      const avg = valid.reduce((a: number, b: any) => a + b.duration_min, 0) / Math.max(1, valid.length);
      plan.alignment.average_duration_min = Number.isFinite(avg) ? +avg.toFixed(1) : undefined;
    }

    const inferredTitle = title || plan?.topic || (plan?.modules?.[0]?.title ? `Lecture – ${plan.modules[0].title}` : "Lecture");
    const saved = upsertLesson({
      id: lessonId, title: inferredTitle, transcript: lectureText, slideText: slidesText,
      plan, summary: plan?.summary, highlights: plan?.key_concepts || [],
      professorEmphases: plan?.emphases || [], courseCode, learningOutcomes,
    });

    const lessonCourse = getCourseForLesson(saved.id);
    if (lessonCourse) rebuildKnowledgeIndex(lessonCourse.id);

    return res.json({ ok: true, plan, lessonId: saved.id });
  } catch (e: any) {
    console.error("[/api/plan-from-text ERROR]", e?.message || e);
    return res.status(500).json({ ok: false, error: e?.message || "server error" });
  }
});

// ---- Quiz from Plan ----
router.post("/quiz-from-plan", async (req, res) => {
  try {
    const { plan, lessonId: quizLessonId } = req.body as { plan?: any; lessonId?: string; courseId?: string };
    if (!plan) return res.status(400).json({ ok: false, error: "plan is required" });
    let crossLessonHint = "";
    if (quizLessonId) {
      const ctx = assembleCourseContext(quizLessonId, "quiz");
      if (ctx.crossLessonBlock) crossLessonHint = `\n\nRELATED LESSONS:\n${ctx.crossLessonBlock}`;
    }
    const prompt = `Generate 10 short quiz questions based on the plan below.\nReturn only the question sentences, one per line.\n${crossLessonHint}\n\nPLAN:\n${JSON.stringify(plan).slice(0, 8000)}`.trim();
    const result = await getModel().generateContent({ contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: 1500 } });
    const text = (result.response.text() || "").replace(/```/g, "").trim();
    const questions = text.split(/\n+/).map((s) => s.replace(/^\d+\.\s*/, "").trim()).filter(Boolean).slice(0, 10);
    return res.json({ ok: true, questions });
  } catch (e: any) {
    console.error("[/api/quiz-from-plan ERROR]", e?.message || e);
    return res.status(500).json({ ok: false, error: e?.message || "server error" });
  }
});

// ---- Quiz Answers ----
router.post("/quiz-answers", async (req, res) => {
  try {
    const { questions, lectureText, slidesText, plan, lessonId } = req.body as {
      questions?: string[]; lectureText?: string; slidesText?: string; plan?: any; lessonId?: string;
    };
    if (!questions?.length || !lectureText || !slidesText) {
      return res.status(400).json({ ok: false, error: "questions, lectureText, slidesText are required" });
    }
    const Q = questions.slice(0, 20);
    let LEC: string; let SLD: string;
    if (lessonId) {
      const lesson = getLesson(lessonId);
      if (lesson?.plan) { const condensed = buildCondensedContext(lesson); LEC = condensed.lecContext; SLD = condensed.sldContext; }
      else { LEC = lectureText.slice(0, 18000); SLD = slidesText.slice(0, 18000); }
    } else { LEC = lectureText.slice(0, 18000); SLD = slidesText.slice(0, 18000); }

    const prompt = `Answer the questions with EVIDENCE. Return ONLY VALID JSON.\n\nSCHEMA:\n{\n  "answers": [{ "q": "string", "short_answer": "string", "explanation": "string", "evidence": { "lec": [{ "quote": "string" }], "slide": [{ "quote": "string" }] }, "confidence": number }]\n}\n\n[LEC]\n${LEC}\n\n[SLIDE]\n${SLD}\n\n[PLAN (optional)]\n${plan ? JSON.stringify(plan).slice(0, 6000) : "—"}\n\n[QUESTIONS]\n${Q.map((q, i) => `${i + 1}. ${q}`).join("\n")}`.trim();
    const result = await getModel().generateContent({ contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: 4000 } });
    const cleaned = (result.response.text() || "").replace(/```json?/gi, "").replace(/```/g, "").trim();
    const j = (() => { try { return JSON.parse(cleaned); } catch { return null; } })();
    if (!j?.answers) return res.status(500).json({ ok: false, error: "JSON parse/schema error" });
    return res.json({ ok: true, answers: j.answers });
  } catch (e: any) {
    console.error("[/api/quiz-answers ERROR]", e?.message || e);
    return res.status(500).json({ ok: false, error: e?.message || "server error" });
  }
});

// ---- Quiz Eval ----
router.post("/quiz-eval", async (req, res) => {
  try {
    const { q, student_answer, lectureText, slidesText, lessonId } = req.body as {
      q?: string; student_answer?: string; lectureText?: string; slidesText?: string; lessonId?: string;
    };
    if (!q || !student_answer || !lectureText || !slidesText) {
      return res.status(400).json({ ok: false, error: "q, student_answer, lectureText, slidesText are required" });
    }
    let LEC: string; let SLD: string;
    if (lessonId) {
      const lesson = getLesson(lessonId);
      if (lesson?.plan) { const condensed = buildCondensedContext(lesson); LEC = condensed.lecContext; SLD = condensed.sldContext; }
      else { LEC = lectureText.slice(0, 14000); SLD = slidesText.slice(0, 14000); }
    } else { LEC = lectureText.slice(0, 14000); SLD = slidesText.slice(0, 14000); }

    const prompt = `Act as an exam grader. Return ONLY VALID JSON.\n\nSCHEMA:\n{ "grade": "correct"|"partial"|"incorrect", "feedback": "string", "missing_points": string[], "evidence": { "lec": [{"quote":"string"}], "slide": [{"quote":"string"}] }, "confidence": number }\n\n[LEC]\n${LEC}\n\n[SLIDE]\n${SLD}\n\n[QUESTION]\n${q}\n\n[STUDENT_ANSWER]\n${student_answer}`.trim();
    const result = await getModel().generateContent({ contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: 800 } });
    const cleaned = (result.response.text() || "").replace(/```json?/gi, "").replace(/```/g, "").trim();
    const j = (() => { try { return JSON.parse(cleaned); } catch { return null; } })();
    if (!j?.grade) return res.status(500).json({ ok: false, error: "JSON parse/schema error" });
    return res.json({ ok: true, ...j });
  } catch (e: any) {
    console.error("[/api/quiz-eval ERROR]", e?.message || e);
    return res.status(500).json({ ok: false, error: e?.message || "server error" });
  }
});

// ---- Quiz Eval Batch ----
router.post("/quiz-eval-batch", async (req, res) => {
  try {
    const { items, lectureText, slidesText, lessonId } = req.body as {
      items?: Array<{ q: string; student_answer: string }>; lectureText?: string; slidesText?: string; lessonId?: string;
    };
    if (!items?.length || !lectureText || !slidesText) {
      return res.status(400).json({ ok: false, error: "items, lectureText, slidesText are required" });
    }
    let LEC: string; let SLD: string;
    if (lessonId) {
      const lesson = getLesson(lessonId);
      if (lesson?.plan) { const condensed = buildCondensedContext(lesson); LEC = condensed.lecContext; SLD = condensed.sldContext; }
      else { LEC = lectureText.slice(0, 14000); SLD = slidesText.slice(0, 14000); }
    } else { LEC = lectureText.slice(0, 14000); SLD = slidesText.slice(0, 14000); }

    const questionsBlock = items.slice(0, 20).map((item, i) => `Q${i + 1}: ${item.q}\nA${i + 1}: ${item.student_answer}`).join("\n\n");
    const prompt = `Act as an exam grader. Grade ALL answers. Return ONLY VALID JSON.\n\nSCHEMA:\n{ "results": [{ "index": number, "grade": "correct"|"partial"|"incorrect", "feedback": "string", "missing_points": string[], "confidence": number }] }\n\n[LEC]\n${LEC}\n\n[SLIDE]\n${SLD}\n\n[STUDENT ANSWERS]\n${questionsBlock}`.trim();
    const result = await getModel().generateContent({ contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: 4000 } });
    const cleaned = (result.response.text() || "").replace(/```json?/gi, "").replace(/```/g, "").trim();
    const j = (() => { try { return JSON.parse(cleaned); } catch { return null; } })();
    if (!j?.results || !Array.isArray(j.results)) return res.status(500).json({ ok: false, error: "JSON parse/schema error" });
    return res.json({ ok: true, results: j.results });
  } catch (e: any) {
    console.error("[/api/quiz-eval-batch ERROR]", e?.message || e);
    return res.status(500).json({ ok: false, error: e?.message || "server error" });
  }
});

// ---- Deviation ----
router.post("/lessons/:id/deviation", async (req, res) => {
  try {
    const lessonId = req.params.id;
    const lesson = getLesson(lessonId);
    if (!lesson) return res.status(404).json({ ok: false, error: "Lesson not found" });
    const transcript = String(lesson.transcript || "").trim();
    const slideText = String(lesson.slideText || "").trim();
    if (!transcript || !slideText) {
      return res.status(400).json({ ok: false, error: "Transcript and slideText are required." });
    }
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

    let pyPath = path.join(process.cwd(), "backend", "transcribe", "deviation.py");
    if (!fs.existsSync(pyPath)) pyPath = path.join(process.cwd(), "transcribe", "deviation.py");
    const pythonBin = process.env.PYTHON_BIN || "python";

    const proc = spawn(pythonBin, [pyPath, "--transcript", trPath, "--slides", slPath, "--title", lesson.title || "Untitled Lesson"], { stdio: ["ignore", "pipe", "pipe"] });
    let out = ""; let err = "";
    proc.stdout.on("data", (data) => (out += data.toString()));
    proc.stderr.on("data", (data) => (err += data.toString()));
    proc.on("close", (code) => {
      try { fs.unlinkSync(trPath); } catch { }
      try { fs.unlinkSync(slPath); } catch { }
      if (code !== 0) return res.status(500).json({ ok: false, error: `Deviation script failed: ${(err || out || "Unknown error").slice(0, 500)}` });
      let result: any;
      try { result = JSON.parse(out); } catch { return res.status(500).json({ ok: false, error: "Failed to parse script output" }); }
      if (!result?.ok) return res.status(500).json({ ok: false, error: result?.error || "Script returned error" });
      const saved = upsertLesson({ id: lessonId, deviation: result } as any);
      return res.json({ ok: true, lessonId: saved.id, deviation: result });
    });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e?.message || "server error" });
  }
});

// ---- IEU Learning Outcomes ----
router.get("/ieu/learning-outcomes", async (req, res) => {
  try {
    const rawCode = String(req.query.code || "").trim();
    if (!rawCode) return res.status(400).json({ ok: false, error: "code param is required" });
    const code = normalizeCourseCode(rawCode);
    const url = `https://se.ieu.edu.tr/en/syllabus_v2/type/read/id/${encodeURIComponent(code)}`;
    const r = await fetch(url);
    if (!r.ok) return res.status(404).json({ ok: false, error: `Syllabus not found for ${code}`, status: r.status });
    const html = await r.text();
    const learningOutcomes = extractLearningOutcomes(html);
    if (!learningOutcomes.length) return res.status(200).json({ ok: false, error: "Learning Outcomes section not found.", url });
    return res.json({ ok: true, code, url, learningOutcomes });
  } catch (err: any) {
    console.error("[/api/ieu/learning-outcomes] Error:", err);
    return res.status(500).json({ ok: false, error: err?.message || "Unknown error" });
  }
});

// ---- Chat (Deep Dive Solo) ----
router.post("/lessons/:id/chat", async (req, res) => {
  try {
    const lessonId = req.params.id;
    const { message, history } = req.body;
    const lesson = getLesson(lessonId);
    if (!lesson) return res.status(404).json({ error: "Lesson not found" });

    const plan = lesson.plan as any;
    const modules = plan?.modules || [];
    const emphases = lesson.professorEmphases || plan?.emphases || [];
    const courseCtx = assembleCourseContext(lessonId, "chat", { userQuery: message });

    const deviationData = (lesson as any).deviation;
    const deviationSummary = deviationData?.segments?.filter((s: any) => s.deviation_type !== 'on_topic')?.slice(0, 4)?.map((s: any) => `• [${s.deviation_type}] ${s.summary || s.topic || 'N/A'}`)?.join('\n') || '';
    const cheatSheet = (lesson as any).cheatSheet;
    const cheatSheetHighlights = cheatSheet?.pitfalls?.slice(0, 4)?.join('\n• ') || '';
    const cheatSheetFormulas = cheatSheet?.formulas?.slice(0, 3)?.join('; ') || '';
    const loAlignment = (lesson as any).loAlignment;
    const loSummary = loAlignment?.segments?.slice(0, 3)?.flatMap((s: any) => s.lo_links?.map((l: any) => l.lo_title) || [])?.filter(Boolean)?.slice(0, 5)?.join(', ') || '';
    const recentHistory = (history || []).slice(-6);
    const historyContext = recentHistory.length > 2 ? `\n=== RECENT CONVERSATION ===\n${recentHistory.map((h: any) => `${h.role === 'user' ? 'Student' : 'Tutor'}: ${(h.content || '').slice(0, 200)}...`).join('\n')}\n` : '';

    const context = `
${courseCtx.courseBlock ? `=== COURSE OVERVIEW ===\n${courseCtx.courseBlock}\n` : ''}
=== LESSON INFORMATION ===
Title: ${lesson.title || "Untitled Lesson"}
Course: ${courseCtx.courseName || (lesson as any).courseCode || 'N/A'}

=== KEY TOPICS (Modules) ===
${modules.slice(0, 6).map((m: any, i: number) => `${i + 1}. ${m.title || m.name || 'Topic'}: ${m.goal || ''}`).join('\n') || 'Not available'}

=== PROFESSOR EMPHASES ===
${emphases.slice(0, 6).map((e: any) => `• ${e.statement || e}${e.why ? ` → ${e.why}` : ''}`).join('\n') || 'None recorded'}

${deviationSummary ? `=== LECTURE DEVIATIONS ===\n${deviationSummary}\n` : ''}
${loSummary ? `=== LEARNING OUTCOMES COVERED ===\n${loSummary}\n` : ''}
${cheatSheetHighlights ? `=== COMMON PITFALLS ===\n• ${cheatSheetHighlights}\n` : ''}
${cheatSheetFormulas ? `=== KEY FORMULAS ===\n${cheatSheetFormulas}\n` : ''}

=== TRANSCRIPT EXCERPT ===
${(lesson.transcript || "").slice(0, 8000)}

=== SLIDE CONTENT EXCERPT ===
${(lesson.slideText || "").slice(0, 5000)}
${courseCtx.crossLessonBlock ? `\n=== RELATED LESSONS ===\n${courseCtx.crossLessonBlock}\n` : ''}
${courseCtx.progressBlock ? `\n=== STUDENT PROGRESS ===\n${courseCtx.progressBlock}\n` : ''}
${historyContext}`;

    const chat = getModel().startChat({
      history: history?.map((h: any) => ({ role: h.role === 'user' ? 'user' : 'model', parts: [{ text: h.content }] })) || [],
      generationConfig: { maxOutputTokens: 2500 },
    });

    const prompt = `
=== CRITICAL RULES ===
1. INSTRUCTION FOLLOWING: Do exactly what the user asks.
2. LANGUAGE: Always respond in English.
3. CONTEXT-BASED ANSWERS: Base answers on the LESSON CONTEXT.
4. ACCURACY: If info is not available, say so.

=== YOUR ROLE ===
You are an EXPERT AI TUTOR for this lesson.${courseCtx.courseId ? ` Full course knowledge available.` : ''}

=== LESSON CONTEXT ===
${context}

=== FORMATTING ===
- **bold** for key terms, bullet points, short paragraphs

=== RESPONSE STRUCTURE ===
1. Answer directly
2. Reference lesson content
3. End with:
---
💡 **Suggested Questions:**
1. [Follow-up]
2. [Deeper]
3. [Application]

=== STUDENT MESSAGE ===
${message}
`;

    const result = await chat.sendMessage(prompt);
    let text = result.response.text();
    const suggestionsMatch = text.match(/💡\s*\*\*Suggested Questions:\*\*\s*([\s\S]*?)$/);
    let suggestions: string[] = [];
    if (suggestionsMatch) {
      suggestions = suggestionsMatch[1].trim().split('\n').map(line => line.replace(/^\d+\.\s*/, '').trim()).filter(s => s.length > 5).slice(0, 3);
    }
    return res.json({ ok: true, text, suggestions });
  } catch (e: any) {
    console.error("Chat error:", e);
    return res.status(500).json({ ok: false, error: e.message });
  }
});

// ---- Mindmap ----
router.post("/lessons/:id/mindmap", async (req, res) => {
  try {
    const lessonId = req.params.id;
    const lesson = getLesson(lessonId);
    if (!lesson || !lesson.plan) return res.status(404).json({ error: "Plan not found" });
    const forceRegen = req.query.force === 'true';
    if (!forceRegen && lesson.mindmapCache?.code) {
      return res.json({ ok: true, code: lesson.mindmapCache.code, cached: true });
    }

    const plan = lesson.plan as any;
    const title = lesson.title || plan.title || "Lesson Topic";
    const modules = plan.modules || [];
    const emphases = lesson.professorEmphases || plan.emphases || [];
    const highlights = lesson.highlights || [];
    const transcript = (lesson.transcript || "").substring(0, 2000);
    const slides = (lesson.slideText || "").substring(0, 1500);
    const mindmapCourseCtx = assembleCourseContext(lessonId, "mindmap");
    const moduleNames = modules.slice(0, 4).map((m: any) => m.title || m.name || "Module");
    const keyPoints = emphases.slice(0, 6).map((e: any) => e.statement || e).filter(Boolean);
    const concepts = highlights.slice(0, 8);

    const prompt = `
You are a MASTER EDUCATOR creating a STUDY GUIDE mindmap.

=== MERMAID SYNTAX (STRICT) ===
- Start with: mindmap
- Root: root((📚 Topic Name))
- Use 2-space indentation
- NO special chars: no [], (), {}, :, backticks, quotes
- Labels: MAX 18 chars

=== STRUCTURE (5 BRANCHES) ===
📚 TOPIC (root)
├── ❓ What - Definition
├── 🎯 Why - Purpose
├── ⚡ How - Steps
├── 💡 Practice - Examples
└── 📝 Remember - Key points

=== LESSON DATA ===
Topic: ${title}
Sections: ${moduleNames.join(", ") || "Introduction, Main Content, Practice"}
Key points: ${keyPoints.slice(0, 4).join(" | ") || "Important concepts"}
Terms: ${concepts.slice(0, 6).join(", ") || "vocabulary"}

=== LECTURE CONTENT ===
${transcript.substring(0, 1000) || "No transcript"}

=== SLIDE CONTENT ===
${slides.substring(0, 800) || "No slides"}

${mindmapCourseCtx.crossLessonBlock ? `=== CONNECTIONS ===\n${mindmapCourseCtx.crossLessonBlock}\n` : ''}
Create a STUDY GUIDE mindmap for "${title}". OUTPUT ONLY mermaid code.
`;

    const result = await getModel().generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 1500 },
    });
    let code = result.response.text().replace(/```mermaid/gi, "").replace(/```/g, "").replace(/\r\n/g, "\n").trim();
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
        if (!processedLine.includes('root((')) processedLine = processedLine.replace(/\(/g, "").replace(/\)/g, "");
        if (processedLine.trim().length > 50) {
          const indent = processedLine.match(/^\s*/)?.[0] || "";
          processedLine = indent + processedLine.trim().substring(0, 50);
        }
      }
      if (processedLine.trim()) cleanLines.push(processedLine);
    }
    if (!cleanLines[0]?.trim().startsWith('mindmap')) cleanLines.unshift('mindmap');
    const hasRoot = cleanLines.some(l => l.includes('root(('));
    if (!hasRoot && cleanLines.length > 1) cleanLines.splice(1, 0, '  root((📚 ' + (title || 'Topic').substring(0, 15) + '))');
    code = cleanLines.join("\n");

    upsertLesson({ id: lessonId, mindmapCache: { code, generatedAt: new Date().toISOString() } } as any);
    return res.json({ ok: true, code });
  } catch (e: any) {
    console.error("Mindmap error:", e);
    return res.status(500).json({ ok: false, error: e.message });
  }
});

// ---- Modules list ----
router.get("/lessons/:id/modules", (req, res) => {
  try {
    const lessonId = req.params.id;
    const lesson = getLesson(lessonId);
    if (!lesson || !lesson.plan) return res.status(404).json({ error: "Lesson not found" });
    const plan = lesson.plan as any;
    const modules = plan.modules || [];
    const moduleList = modules.map((m: any, index: number) => ({
      id: index,
      title: m.title || m.name || `Module ${index + 1}`,
      topics: (m.topics || m.content || []).slice(0, 5).map((t: any) => typeof t === 'string' ? t : (t.title || t.name || 'Topic'))
    }));
    const allModulesOption = { id: -1, title: "📚 Tüm Modüller (Genel Bakış)", topics: moduleList.slice(0, 4).map((m: any) => m.title) };
    return res.json({ ok: true, lessonTitle: lesson.title || "Lesson", modules: [allModulesOption, ...moduleList] });
  } catch (e: any) {
    console.error("Modules list error:", e);
    return res.status(500).json({ ok: false, error: e.message });
  }
});

// ---- Mindmap Module ----
router.post("/lessons/:id/mindmap/module", async (req, res) => {
  try {
    const lessonId = req.params.id;
    const moduleIndex = req.body.moduleIndex ?? -1;
    const lesson = getLesson(lessonId);
    if (!lesson || !lesson.plan) return res.status(404).json({ error: "Plan not found" });

    const forceRegen = req.query.force === 'true';
    const cacheKey = String(moduleIndex);
    const cached = lesson.mindmapModuleCache?.[cacheKey];
    if (!forceRegen && cached?.code) {
      return res.json({ ok: true, code: cached.code, moduleTitle: (cached as any).moduleTitle || "", cached: true });
    }

    const plan = lesson.plan as any;
    const modules = plan.modules || [];
    const lessonTitle = lesson.title || plan.title || "Lesson Topic";
    let targetTitle: string; let targetContent: string;

    if (moduleIndex === -1) {
      targetTitle = lessonTitle;
      targetContent = modules.slice(0, 4).map((m: any) => {
        const title = m.title || m.name || "Module";
        const topics = (m.topics || m.content || []).slice(0, 3).map((t: any) => typeof t === 'string' ? t : (t.title || '')).join(", ");
        return `${title}: ${topics}`;
      }).join("\n");
    } else {
      const targetModule = modules[moduleIndex];
      if (!targetModule) return res.status(404).json({ error: "Module not found" });
      targetTitle = targetModule.title || targetModule.name || `Module ${moduleIndex + 1}`;
      const topics = targetModule.topics || targetModule.content || [];
      targetContent = topics.map((t: any) => typeof t === 'string' ? t : (t.title || t.name || t.description || '')).join("\n");
    }

    const prompt = `
You are a MASTER EDUCATOR creating a STUDY GUIDE mindmap for a specific module.

=== MERMAID SYNTAX (STRICT) ===
- Start with: mindmap
- Root: root((📚 Topic Name))
- Use 2-space indentation
- NO special chars
- Labels: MAX 18 chars

=== MODULE DATA ===
Module Title: ${targetTitle}
Module Content: ${targetContent.substring(0, 1000)}

OUTPUT ONLY mermaid code for "${targetTitle}".
`;

    const result = await getModel().generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 1200 },
    });
    let code = result.response.text().replace(/```mermaid/gi, "").replace(/```/g, "").replace(/\r\n/g, "\n").trim();
    const mLines = code.split("\n");
    const cleanMLines: string[] = [];
    for (const line of mLines) {
      let processedLine = line;
      const trimmed = line.trim();
      if (!trimmed && cleanMLines.length < 2) continue;
      if (trimmed.includes('```')) continue;
      if (/^[:\-\[\]\(\)\{\}]+$/.test(trimmed)) continue;
      if (!trimmed.startsWith('mindmap') && !trimmed.startsWith('root((')) {
        processedLine = processedLine.replace(/[:\[\]\{\}`"]/g, "");
        if (!processedLine.includes('root((')) processedLine = processedLine.replace(/\(/g, "").replace(/\)/g, "");
        if (processedLine.trim().length > 50) {
          const indent = processedLine.match(/^\s*/)?.[0] || "";
          processedLine = indent + processedLine.trim().substring(0, 50);
        }
      }
      if (processedLine.trim()) cleanMLines.push(processedLine);
    }
    if (!cleanMLines[0]?.trim().startsWith('mindmap')) cleanMLines.unshift('mindmap');
    const hasRoot2 = cleanMLines.some(l => l.includes('root(('));
    if (!hasRoot2) cleanMLines.splice(1, 0, '  root((📚 ' + targetTitle.substring(0, 15) + '))');
    code = cleanMLines.join("\n");

    const existingModuleCache = lesson.mindmapModuleCache || {};
    existingModuleCache[cacheKey] = { code, generatedAt: new Date().toISOString(), moduleTitle: targetTitle } as any;
    upsertLesson({ id: lessonId, mindmapModuleCache: existingModuleCache } as any);
    return res.json({ ok: true, code, moduleTitle: targetTitle });
  } catch (e: any) {
    console.error("Module mindmap error:", e);
    return res.status(500).json({ ok: false, error: e.message });
  }
});

// ---- Mindmap Node Detail ----
router.post("/lessons/:id/mindmap/node-detail", async (req, res) => {
  try {
    const lessonId = req.params.id;
    const { nodeName, action } = req.body as { nodeName: string; action: "explain" | "example" | "quiz" };
    if (!nodeName || !action) return res.status(400).json({ ok: false, error: "nodeName and action required" });
    const lesson = getLesson(lessonId);
    if (!lesson) return res.status(404).json({ ok: false, error: "Lesson not found" });

    const transcript = (lesson.transcript || "").substring(0, 3000);
    const lessonTitle = lesson.title || "Lesson";
    let prompt = "";

    if (action === "explain") {
      prompt = `Explain "${nodeName}" VERY BRIEFLY.\n\nContext:\n${transcript.substring(0, 1000)}\n\nReturn ONLY JSON:\n{ "title": "${nodeName}", "explanation": "2-3 sentences", "keyPoints": ["point"], "relatedConcepts": ["concept"] }`;
    } else if (action === "example") {
      prompt = `Give ONE simple example for "${nodeName}".\n\nContext:\n${transcript.substring(0, 1000)}\n\nReturn ONLY JSON:\n{ "title": "${nodeName}", "example": { "scenario": "1 sentence", "explanation": "1 sentence", "takeaway": "5-8 words" } }`;
    } else if (action === "quiz") {
      prompt = `Create a quiz question about "${nodeName}" from "${lessonTitle}".\n\nContext:\n${transcript.substring(0, 1500)}\n\nReturn ONLY JSON:\n{ "title": "${nodeName}", "quiz": { "question": "?", "options": ["A)", "B)", "C)", "D)"], "correctAnswer": "A", "explanation": "why" } }`;
    }

    const result = await getModel().generateContent({ contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: 800 } });
    let responseText = result.response.text().replace(/```json?/gi, "").replace(/```/g, "").trim();
    let parsed;
    try { parsed = JSON.parse(responseText); } catch { return res.status(500).json({ ok: false, error: "Failed to parse AI response" }); }
    return res.json({ ok: true, action, ...parsed });
  } catch (e: any) {
    console.error("[Node Detail] Error:", e);
    return res.status(500).json({ ok: false, error: e.message });
  }
});

export default router;
