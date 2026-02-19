export function buildCheatSheetPrompt(input: {
  title: string; transcript: string; slideText: string;
  learningOutcomes?: string[]; emphases?: any[]; language?: 'tr' | 'en';
}): string {
  const LEC = (input.transcript || "").slice(0, 18000);
  const SLD = (input.slideText || "").slice(0, 12000);
  const LOS = (input.learningOutcomes || []).map((x, i) => `LO${i + 1}: ${String(x || "").trim()}`).join("\n");
  const EMPH = input.emphases ? JSON.stringify(input.emphases).slice(0, 6000) : "—";
  const lang = input.language || 'tr';
  const langDirective = lang === 'tr'
    ? 'IMPORTANT: Write ALL content (title, headings, bullets, formulas, pitfalls, quickQuiz) in TURKISH. Use Turkish language only.'
    : 'IMPORTANT: Write ALL content (title, headings, bullets, formulas, pitfalls, quickQuiz) in ENGLISH. Use English language only.';

  return `
You are an exam-focused teaching assistant.

${langDirective}

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
