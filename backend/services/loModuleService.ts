import { getModel, stripCodeFences, tryParseJSON } from "./aiService";
import { LoLink, LoAlignedSegment, LoAlignment } from "../types";

export function buildCondensedContext(lesson: any): { lecContext: string; sldContext: string } {
  const plan = lesson.plan;
  if (!plan) {
    return {
      lecContext: (lesson.transcript || "").slice(0, 18000),
      sldContext: (lesson.slideText || "").slice(0, 18000),
    };
  }
  const parts: string[] = [];
  if (plan.topic) parts.push(`Topic: ${plan.topic}`);
  if (plan.key_concepts?.length) parts.push(`Key concepts: ${plan.key_concepts.join(", ")}`);
  if (plan.modules?.length) {
    const modSummary = plan.modules.slice(0, 6).map((m: any) => `- ${m.title || "Module"}: ${m.goal || ""}`).join("\n");
    parts.push(`Modules:\n${modSummary}`);
  }
  if (plan.emphases?.length) {
    const emphSummary = plan.emphases.slice(0, 8).map((e: any) => `- ${e.statement}${e.why ? ` (${e.why})` : ""}`).join("\n");
    parts.push(`Professor emphases:\n${emphSummary}`);
  }
  const condensedPlan = parts.join("\n\n");
  const transcriptExcerpt = (lesson.transcript || "").slice(0, 4000);
  const lecContext = `${condensedPlan}\n\n--- Transcript excerpt ---\n${transcriptExcerpt}`;
  const sldContext = (lesson.slideText || "").slice(0, 4000);
  return { lecContext, sldContext };
}

export function segmentTranscript(lectureText: string): { index: number; text: string }[] {
  const raw = (lectureText || "").replace(/\r\n/g, "\n");
  let parts = raw.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  if (!parts.length) return [{ index: 0, text: raw.trim() }];
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

export const hasAlignment = (plan: any) =>
  !!plan?.alignment?.items?.length &&
  Number.isFinite(plan?.alignment?.average_duration_min ?? NaN);

export function buildLoModulesPrompt(input: {
  transcript: string; slideText: string; learningOutcomes: string[];
  loAlignment?: LoAlignment; plan?: any;
}): string {
  const LEC = input.transcript.slice(0, 16000);
  const SLD = input.slideText.slice(0, 8000);
  const LO_LIST = input.learningOutcomes.map((lo, i) => `LO${i + 1}: ${lo}`).join("\n");
  const ALIGN_SNIPPET = input.loAlignment ? JSON.stringify(input.loAlignment).slice(0, 8000) : "—";
  const PLAN_SNIPPET = input.plan ? JSON.stringify(input.plan).slice(0, 6000) : "—";

  return `
You are an expert learning designer and exam coach.

GOAL:
Transform the raw transcript and slides into SMALL, HIGH-RECALL learning modules,
each tightly linked to ONE official Learning Outcome (LO).

CRITICAL ALIGNMENT RULES:
1. **STRICT EVIDENCE CHECK**: Only generate content for an LO if there is clear evidence in the Transcript (LEC) or Slides (SLIDE).
2. **NO HALLUCINATIONS**: If an LO is NOT covered, state that in "oneLineGist" and keep other fields minimal.
3. **SOURCE PRIORITY**: Prioritize Transcript over Slides.

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
Return ONLY VALID JSON with schema:
{
  "modules": [
    {
      "loId": "LO1", "loTitle": "string", "oneLineGist": "string",
      "coreIdeas": ["string"], "mustRemember": ["string"],
      "intuitiveExplanation": "string",
      "examples": [{ "label": "string", "description": "string" }],
      "typicalQuestions": ["string"], "commonTraps": ["string"],
      "miniQuiz": [{ "question": "string", "answer": "string", "why": "string" }],
      "recommended_study_time_min": number
    }
  ]
}

RULES:
- One module per LO. Use the same LO ids.
- "coreIdeas" 3–6 bullet points.
- "mustRemember" 3–5 key facts.
- "intuitiveExplanation" max 6–7 sentences.
- "miniQuiz" 2–4 items per LO.
- DO NOT output any text outside the JSON.
`.trim();
}

export async function generateLoAlignmentForLesson(
  lectureText: string, slidesText: string, learningOutcomes: string[]
): Promise<LoAlignment> {
  const model = getModel();
  const baseSegments = segmentTranscript(lectureText);
  if (!baseSegments.length) throw new Error("Transcript is empty; cannot generate alignment.");
  const LOs = (learningOutcomes || []).map((t) => String(t || "").trim()).filter(Boolean);
  if (!LOs.length) throw new Error("Learning Outcomes list is empty.");
  const LO_LIST = LOs.map((lo, i) => `LO${i + 1}: ${lo}`).join("\n");
  const SEGMENTS_JSON = JSON.stringify(baseSegments.map((s) => ({ index: s.index, text: s.text }))).slice(0, 12000);
  const SLD = (slidesText || "").slice(0, 4000);

  const prompt = `
You are an instructional designer. Below you see the official Learning Outcomes and pre-segmented transcript blocks.

Task: For each transcript segment, link it to 0–3 LOs.

OUTPUT SCHEMA (STRICT):
{
  "segments": [
    { "index": number, "lo_links": [{ "lo_id": "LO1", "lo_title": "string", "confidence": number }] }
  ]
}

RULES:
- Do NOT change segment "index" values.
- "confidence" is 0–1.
- Output ONLY valid JSON.

[LEARNING_OUTCOMES]
${LO_LIST}

[SEGMENTS]
${SEGMENTS_JSON}

[SLIDE_HINTS (optional)]
${SLD || "—"}
`.trim();

  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { maxOutputTokens: 4000 },
  });
  const rawText = result.response.text() || "";
  const cleaned = stripCodeFences(rawText);
  const parsed = tryParseJSON(cleaned);
  if (!parsed?.segments || !Array.isArray(parsed.segments)) throw new Error("LO alignment JSON parse/schema error");

  const linksByIndex = new Map<number, LoLink[]>();
  for (const item of parsed.segments) {
    if (typeof item?.index !== "number" || !Array.isArray(item?.lo_links)) continue;
    const links: LoLink[] = [];
    for (const l of item.lo_links) {
      if (!l) continue;
      const lo_id = String(l.lo_id || "").trim();
      const lo_title = String(l.lo_title || "").trim();
      const conf = Number(l.confidence);
      if (!lo_id || !lo_title || !Number.isFinite(conf)) continue;
      links.push({ lo_id, lo_title, confidence: Math.max(0, Math.min(1, conf)) });
    }
    linksByIndex.set(item.index, links);
  }

  const segments: LoAlignedSegment[] = baseSegments.map((seg) => ({
    index: seg.index, text: seg.text, lo_links: linksByIndex.get(seg.index) || [],
  }));
  return { segments };
}

export async function generateAlignmentOnly(lectureText: string, slidesText: string) {
  const model = getModel();
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
      "topic": "string", "concepts": string[], "in_both": boolean,
      "emphasis_level": "high"|"medium"|"low",
      "lecture_quotes": string[], "slide_refs": string[],
      "duration_min": number, "confidence": number
    }
  ]
}

RULES:
- "items" must contain at least 5 entries.
- Output ONLY valid JSON.

[LEC]
${LEC}

[SLIDE]
${SLD}
`.trim();

  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { maxOutputTokens: 4000 },
  });
  const rawText = result.response.text() || "";
  const cleaned = stripCodeFences(rawText);
  const j = tryParseJSON(cleaned);
  if (!j) throw new Error("Alignment JSON parse error");
  return j;
}
