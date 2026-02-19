import { Router } from "express";
import { buildConnections, getConnections } from "../controllers/connectionsController";
import { listLessons, getLesson } from "../controllers/lessonControllers";
import { getModel } from "../services/aiService";

const router = Router();

router.get("/connections", (_req, res) => {
  try {
    const connections = getConnections();
    res.json({ ok: true, connections });
  } catch (err: any) {
    console.error("GET /api/connections error:", err);
    res.status(500).json({ ok: false, error: err.message || "Failed to get connections" });
  }
});

router.post("/connections/build", async (_req, res) => {
  try {
    const connections = await buildConnections(getModel());
    res.json({ ok: true, connections });
  } catch (err: any) {
    console.error("POST /api/connections/build error:", err);
    res.status(500).json({ ok: false, error: err.message || "Failed to build connections" });
  }
});

router.post("/connections/deep-dive", async (req, res) => {
  try {
    const { concept, lessonTitles, relatedConcepts } = req.body as {
      concept: string;
      lessonTitles: string[];
      relatedConcepts: string[];
    };
    if (!concept) {
      return res.status(400).json({ ok: false, error: "concept is required" });
    }

    const allLessons = listLessons();
    const relevantLessons = allLessons.filter((l) =>
      lessonTitles.some((t) => l.title === t)
    );

    const lessonContext = relevantLessons
      .map((l) => {
        const keyConcepts = l.plan?.key_concepts?.join(", ") || "N/A";
        const emphases = (l.plan?.emphases || l.professorEmphases || [])
          .map((e: any) => e.statement)
          .filter(Boolean)
          .slice(0, 5)
          .join("; ");
        return `Lesson "${l.title}": Key concepts: ${keyConcepts}. Emphases: ${emphases || "N/A"}.`;
      })
      .join("\n");

    const prompt = `You are an expert educational AI tutor. Provide a detailed 3-5 paragraph analysis of how the concept "${concept}" evolves and connects across multiple lessons.

Context about the lessons:
${lessonContext}

Related concepts: ${relatedConcepts.join(", ") || "none"}

Your analysis should:
1. Explain what this concept means and why it is fundamental
2. Describe how it appears differently in each lesson and how the understanding deepens
3. Show connections to the related concepts listed
4. Provide practical study advice for mastering this cross-lesson concept

Write in a clear, educational tone. Use paragraphs, not bullet points.`;

    const result = await getModel().generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });
    const analysis = result.response.text();

    res.json({ ok: true, analysis });
  } catch (err: any) {
    console.error("POST /api/connections/deep-dive error:", err);
    res.status(500).json({ ok: false, error: err.message || "Failed to generate deep dive" });
  }
});

export default router;
