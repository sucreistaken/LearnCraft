import { Router } from "express";
import {
  listCourses, getCourse, createCourse, updateCourse, deleteCourse,
  addLessonToCourse, removeLessonFromCourse, getCourseLessons,
  rebuildKnowledgeIndex, getCourseProgress, exportCourseData,
} from "../controllers/courseController";
import { assembleCourseWideContext } from "../controllers/contextAssembler";
import { upsertLesson } from "../controllers/lessonControllers";
import { getModel } from "../services/aiService";

const router = Router();

router.get("/courses", (_req, res) => {
  res.json({ ok: true, courses: listCourses() });
});

router.get("/courses/:id", (req, res) => {
  const course = getCourse(req.params.id);
  if (!course) return res.status(404).json({ ok: false, error: "Course not found" });
  res.json({ ok: true, course });
});

router.post("/courses", (req, res) => {
  const { code, name, description, learningOutcomes, settings } = req.body;
  if (!code || !name) return res.status(400).json({ ok: false, error: "code and name required" });
  const course = createCourse({ code, name, description, learningOutcomes, settings });
  res.json({ ok: true, course });
});

router.patch("/courses/:id", (req, res) => {
  const course = updateCourse(req.params.id, req.body);
  if (!course) return res.status(404).json({ ok: false, error: "Course not found" });
  res.json({ ok: true, course });
});

router.delete("/courses/:id", (req, res) => {
  const ok = deleteCourse(req.params.id);
  if (!ok) return res.status(404).json({ ok: false, error: "Course not found" });
  res.json({ ok: true });
});

router.post("/courses/:id/lessons/:lessonId", (req, res) => {
  const course = addLessonToCourse(req.params.id, req.params.lessonId);
  if (!course) return res.status(404).json({ ok: false, error: "Course not found" });
  upsertLesson({ id: req.params.lessonId, courseId: req.params.id } as any);
  rebuildKnowledgeIndex(req.params.id);
  res.json({ ok: true, course });
});

router.delete("/courses/:id/lessons/:lessonId", (req, res) => {
  const course = removeLessonFromCourse(req.params.id, req.params.lessonId);
  if (!course) return res.status(404).json({ ok: false, error: "Course not found" });
  upsertLesson({ id: req.params.lessonId, courseId: undefined } as any);
  rebuildKnowledgeIndex(req.params.id);
  res.json({ ok: true, course });
});

router.get("/courses/:id/lessons", (req, res) => {
  const lessons = getCourseLessons(req.params.id);
  res.json({ ok: true, lessons });
});

router.post("/courses/:id/rebuild-index", (req, res) => {
  const index = rebuildKnowledgeIndex(req.params.id);
  if (!index) return res.status(404).json({ ok: false, error: "Course not found" });
  res.json({ ok: true, knowledgeIndex: index });
});

router.get("/courses/:id/knowledge-index", (req, res) => {
  const course = getCourse(req.params.id);
  if (!course) return res.status(404).json({ ok: false, error: "Course not found" });
  res.json({ ok: true, knowledgeIndex: course.knowledgeIndex || null });
});

router.post("/courses/:id/chat", async (req, res) => {
  try {
    const courseId = req.params.id;
    const { message, history } = req.body;
    const course = getCourse(courseId);
    if (!course) return res.status(404).json({ ok: false, error: "Course not found" });
    const courseCtx = assembleCourseWideContext(courseId);
    const chat = getModel().startChat({
      history: history?.map((h: any) => ({ role: h.role === 'user' ? 'user' : 'model', parts: [{ text: h.content }] })) || [],
      generationConfig: { maxOutputTokens: 2500 },
    });

    const prompt = `
=== YOUR ROLE ===
You are an EXPERT AI TUTOR for: ${course.code} - ${course.name}.

=== COURSE CONTEXT ===
${courseCtx.fullContext}

=== STUDENT MESSAGE ===
${message}

Answer directly, reference specific lessons, end with 3 suggested follow-up questions.
`;
    const result = await chat.sendMessage(prompt);
    let text = result.response.text();
    const suggestionsMatch = text.match(/\*\*Suggested Questions:\*\*\s*([\s\S]*?)$/);
    let suggestions: string[] = [];
    if (suggestionsMatch) {
      suggestions = suggestionsMatch[1].trim().split('\n').map(line => line.replace(/^\d+\.\s*/, '').trim()).filter(s => s.length > 5).slice(0, 3);
    }
    return res.json({ ok: true, text, suggestions });
  } catch (e: any) {
    console.error("Course chat error:", e);
    return res.status(500).json({ ok: false, error: e.message });
  }
});

router.get("/courses/:id/progress", (req, res) => {
  const progress = getCourseProgress(req.params.id);
  if (!progress) return res.status(404).json({ ok: false, error: "Course not found" });
  res.json({ ok: true, progress });
});

router.post("/courses/:id/study-schedule", async (req, res) => {
  try {
    const courseId = req.params.id;
    const { examDate } = req.body;
    const course = getCourse(courseId);
    if (!course) return res.status(404).json({ ok: false, error: "Course not found" });
    const progress = getCourseProgress(courseId);
    const ki = course.knowledgeIndex;
    const effectiveExamDate = examDate || course.settings?.examDate || "Not specified";

    const prompt = `Generate a personalized weekly study schedule in JSON format.
Course: ${course.code} - ${course.name}
Total Lessons: ${progress?.totalLessons || 0}, Completed: ${progress?.completedLessons || 0}
Quiz Average: ${progress?.overallQuizAvg ? Math.round(progress.overallQuizAvg * 100) + '%' : 'N/A'}
Weak Topics: ${progress?.weakTopics?.join(', ') || 'None'}
Exam Date: ${effectiveExamDate}
${ki ? `Themes: ${ki.overview.courseThemes.join(', ')}` : ''}

Return JSON: { "days": [{ "day": "Monday", "slots": [{ "time": "Morning", "activity": "..." }] }], "tips": ["..."] }`;

    const result = await getModel().generateContent(prompt);
    const text = result.response.text();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return res.status(500).json({ ok: false, error: "Failed to parse schedule" });
    const parsed = JSON.parse(jsonMatch[0]);
    const schedule = { courseId, generatedAt: new Date().toISOString(), examDate: effectiveExamDate !== "Not specified" ? effectiveExamDate : undefined, days: parsed.days || [], tips: parsed.tips || [] };
    return res.json({ ok: true, schedule });
  } catch (e: any) {
    console.error("Schedule generation error:", e);
    return res.status(500).json({ ok: false, error: e.message });
  }
});

router.get("/courses/:id/export", (req, res) => {
  const data = exportCourseData(req.params.id);
  if (!data) return res.status(404).json({ ok: false, error: "Course not found" });
  res.json({ ok: true, export: data });
});

export default router;
