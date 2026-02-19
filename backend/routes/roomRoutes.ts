import { Router } from "express";
import {
  createRoom,
  getRoom as getRoomById,
  getRoomByCode,
  listActiveRooms,
  deleteRoom,
  getRoomsByUserId,
} from "../controllers/roomController";
import { loadWorkspace } from "../controllers/workspaceController";
import { getLesson, upsertLesson } from "../controllers/lessonControllers";
import { getModel, stripCodeFences, tryParseJSON } from "../services/aiService";
import { buildCondensedContext } from "../services/loModuleService";

const router = Router();

router.post("/rooms", (req, res) => {
  const { name, hostId, settings, lessonId, lessonTitle } = req.body;
  if (!name || !hostId) return res.status(400).json({ ok: false, error: "name and hostId required" });
  if (!lessonId) return res.status(400).json({ ok: false, error: "lessonId is required - every room must be linked to a lesson" });
  const room = createRoom(name, hostId, settings, lessonId, lessonTitle || "");
  res.json({ ok: true, room });
});

router.get("/rooms", (_req, res) => {
  const rooms = listActiveRooms();
  res.json({ ok: true, rooms });
});

router.get("/rooms/my/:userId", (req, res) => {
  try {
    const rooms = getRoomsByUserId(req.params.userId);
    res.json({ ok: true, rooms });
  } catch {
    res.json({ ok: true, rooms: [] });
  }
});

router.get("/rooms/code/:code", (req, res) => {
  const room = getRoomByCode(req.params.code);
  if (!room) return res.status(404).json({ ok: false, error: "Room not found" });
  res.json({ ok: true, room });
});

router.get("/rooms/:id", (req, res) => {
  const room = getRoomById(req.params.id);
  if (!room) return res.status(404).json({ ok: false, error: "Room not found" });
  res.json({ ok: true, room });
});

router.get("/rooms/:id/workspace", (req, res) => {
  const room = getRoomById(req.params.id);
  if (!room) return res.status(404).json({ ok: false, error: "Room not found" });
  const workspace = loadWorkspace(req.params.id);
  res.json({ ok: true, workspace });
});

router.delete("/rooms/:id", (req, res) => {
  const requesterId = req.query.userId as string | undefined;
  const ok = deleteRoom(req.params.id, requesterId);
  if (!ok) return res.status(404).json({ ok: false, error: "Room not found or not authorized" });
  res.json({ ok: true });
});

// Room Deep Dive Chat (AI)
router.post("/rooms/:id/deepdive/ask", async (req, res) => {
  try {
    const room = getRoomById(req.params.id);
    if (!room) return res.status(404).json({ ok: false, error: "Room not found" });
    const { message, history } = req.body;
    const lessonId = room.lessonId;
    if (!lessonId) return res.status(400).json({ ok: false, error: "Room has no linked lesson" });
    const lesson = getLesson(lessonId);
    if (!lesson) return res.status(404).json({ ok: false, error: "Linked lesson not found" });

    const plan = lesson.plan as any;
    const modules = plan?.modules || [];
    const emphases = (lesson as any).professorEmphases || plan?.emphases || [];
    const { lecContext: roomLec, sldContext: roomSld } = buildCondensedContext(lesson);

    const context = `
=== LESSON INFORMATION ===
Title: ${lesson.title || "Untitled Lesson"}

=== KEY TOPICS ===
${modules.slice(0, 6).map((m: any, i: number) => `${i + 1}. ${m.title || m.name || 'Topic'}: ${m.goal || ''}`).join('\n') || 'Not available'}

=== PROFESSOR EMPHASES ===
${emphases.slice(0, 6).map((e: any) => `- ${e.statement || e}${e.why ? ` (${e.why})` : ''}`).join('\n') || 'None'}

=== TRANSCRIPT EXCERPT ===
${roomLec.slice(0, 6000)}

=== SLIDE CONTENT EXCERPT ===
${roomSld.slice(0, 4000)}
`;

    const recentHistory = (history || []).slice(-10);
    const chat = getModel().startChat({
      history: recentHistory.map((h: any) => ({
        role: h.role === 'user' ? 'user' : 'model',
        parts: [{ text: h.content || h.text }]
      })),
      generationConfig: { maxOutputTokens: 2500 },
    });

    const prompt = `You are a collaborative study assistant for a group of students studying together. Use this lesson context to help them:

${context}

Student question: ${message}

Respond helpfully, concisely, and with academic accuracy. If the question relates to the lesson content, reference specific details. Always respond in the same language as the question. Also suggest 2-3 follow-up questions at the end labeled as "Suggested:".`;

    const result = await chat.sendMessage(prompt);
    const text = result.response.text();
    const suggestionsMatch = text.match(/Suggested:?\s*\n([\s\S]*?)$/i);
    let suggestions: string[] = [];
    let cleanText = text;
    if (suggestionsMatch) {
      cleanText = text.slice(0, suggestionsMatch.index).trim();
      suggestions = suggestionsMatch[1]
        .split('\n')
        .map((s: string) => s.replace(/^[-*\d.)\s]+/, '').trim())
        .filter((s: string) => s.length > 0)
        .slice(0, 3);
    }
    res.json({ ok: true, text: cleanText, suggestions });
  } catch (err: any) {
    console.error("Room deep dive error:", err);
    res.status(500).json({ ok: false, error: err.message || "AI chat failed" });
  }
});

// Room Flashcard Generation (AI)
router.post("/rooms/:id/flashcards/generate", async (req, res) => {
  try {
    const room = getRoomById(req.params.id);
    if (!room) return res.status(404).json({ ok: false, error: "Room not found" });
    const lessonId = room.lessonId;
    if (!lessonId) return res.status(400).json({ ok: false, error: "Room has no linked lesson" });
    const lesson = getLesson(lessonId);
    if (!lesson) return res.status(404).json({ ok: false, error: "Linked lesson not found" });

    const plan = lesson.plan as any;
    const emphases = (lesson as any).professorEmphases || plan?.emphases || [];
    const modules = plan?.modules || [];
    const { lecContext: fcLec } = buildCondensedContext(lesson);
    const context = `
Title: ${lesson.title}
Topics: ${modules.map((m: any) => m.title || m.name).join(', ')}
Key Emphases: ${emphases.slice(0, 5).map((e: any) => e.statement || e).join('; ')}
Transcript excerpt: ${fcLec.slice(0, 3000)}
`;

    const prompt = `Generate 8 high-quality flashcards for collaborative study based on this lesson content:

${context}

Return a JSON array of objects with "front", "back", and "topicName" fields.
Make cards focused on key concepts, definitions, and important relationships.
Vary difficulty. Return ONLY valid JSON array, no other text.`;

    const result = await getModel().generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 2000 },
    });
    const raw = result.response.text();
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return res.status(500).json({ ok: false, error: "Failed to parse AI response" });
    const cards = JSON.parse(jsonMatch[0]);
    res.json({ ok: true, cards });
  } catch (err: any) {
    console.error("Room flashcard generation error:", err);
    res.status(500).json({ ok: false, error: err.message || "Generation failed" });
  }
});

// Room Mind Map AI Ask
router.post("/rooms/:id/mindmap/ask", async (req, res) => {
  try {
    const room = getRoomById(req.params.id);
    if (!room) return res.status(404).json({ ok: false, error: "Room not found" });
    const { nodeLabel, question } = req.body;
    const lessonId = room.lessonId;
    if (!lessonId) return res.status(400).json({ ok: false, error: "Room has no linked lesson" });
    const lesson = getLesson(lessonId);
    if (!lesson) return res.status(404).json({ ok: false, error: "Linked lesson not found" });

    const { lecContext: mmLec } = buildCondensedContext(lesson);
    const prompt = `You are helping students understand the topic "${nodeLabel}" from the lesson "${lesson.title}".

Lesson context: ${mmLec.slice(0, 3000)}

Student question: ${question || `Explain "${nodeLabel}" in detail`}

Provide a clear, concise explanation. Respond in the same language as the question.`;

    const result = await getModel().generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 1500 },
    });
    const text = result.response.text();
    res.json({ ok: true, text });
  } catch (err: any) {
    console.error("Room mindmap AI error:", err);
    res.status(500).json({ ok: false, error: err.message || "AI failed" });
  }
});

export default router;
