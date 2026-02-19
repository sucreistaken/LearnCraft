import { Router } from "express";
import multer from "multer";
import path from "path";
import os from "os";
import fs from "fs";
import { spawn } from "child_process";
import readline from "readline";
import { EventEmitter } from "events";
import { getLesson, upsertLesson } from "../controllers/lessonControllers";
import { getModel } from "../services/aiService";

const router = Router();
const upload = multer({ dest: path.join(os.tmpdir(), "learncraft_uploads") });

type Job = { emitter: EventEmitter; done: boolean; transcript: string };
const jobs = new Map<string, Job>();

function uid() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }

function formatTimestamp(seconds: number): string {
  const totalSeconds = Math.floor(seconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// POST /api/transcribe/start
router.post("/transcribe/start", upload.single("file"), async (req, res) => {
  try {
    const file = (req as any).file as Express.Multer.File | undefined;
    const { lessonId } = req.body as { lessonId?: string };
    if (!file) return res.status(400).json({ ok: false, error: "file is required" });

    const jobId = uid();
    const emitter = new EventEmitter();
    jobs.set(jobId, { emitter, done: false, transcript: "" });

    const pyPath = path.resolve(__dirname, "..", "transcribe", "run.py");
    const pythonBin = process.env.PYTHON_BIN || "python";
    console.log("[STT] start", { jobId, lessonId, file: file.originalname, tmp: file.path, pyPath });

    const proc = spawn(pythonBin, [pyPath, file.path, "--lang", "en"], { stdio: ["ignore", "pipe", "pipe"] });
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
          job.transcript += `[${formatTimestamp(msg.start)} – ${formatTimestamp(msg.end)}] ${msg.text}\n`;
        }
        emitter.emit("msg", msg);
      } catch { }
    });

    proc.on("close", (code) => {
      const job = jobs.get(jobId);
      if (!job) return;
      job.done = true;
      emitter.emit("msg", { type: "done", progress: 1.0, code });
      try { fs.unlinkSync(file.path); } catch { }
      if (lessonId) {
        const existing = getLesson(lessonId);
        if (existing) upsertLesson({ id: lessonId, transcript: job.transcript });
      }
      setTimeout(() => jobs.delete(jobId), 5 * 60 * 1000);
    });

    return res.json({ ok: true, jobId });
  } catch (e: any) {
    console.error("[STT] start error:", e);
    return res.status(500).json({ ok: false, error: e?.message || "server error" });
  }
});

// POST /api/slides/upload
router.post("/slides/upload", upload.single("file"), async (req, res) => {
  try {
    const file = (req as any).file as Express.Multer.File | undefined;
    const { lessonId } = req.body as { lessonId?: string };
    if (!file) return res.status(400).json({ ok: false, error: "No file uploaded" });
    if (!lessonId) return res.status(400).json({ ok: false, error: "lessonId is required" });

    const pyPath = path.resolve(__dirname, "..", "ocr_service.py");
    const pythonBin = process.env.PYTHON_BIN || "python";
    const originalExt = path.extname(file.originalname);
    const newPath = file.path + originalExt;
    fs.renameSync(file.path, newPath);
    file.path = newPath;
    console.log(`[OCR] Starting for lesson ${lessonId}, file: ${file.path}`);

    const proc = spawn(pythonBin, [pyPath, file.path]);
    let stdoutData = ""; let stderrData = "";
    proc.stdout.on("data", (data) => { stdoutData += data.toString(); });
    proc.stderr.on("data", (data) => { stderrData += data.toString(); console.error("[OCR Stderr]:", data.toString()); });

    proc.on("close", async (code) => {
      try {
        try { fs.unlinkSync(file.path); } catch { }
        if (code !== 0) {
          return res.status(500).json({ ok: false, error: "OCR script failed", code, details: stderrData });
        }
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

        // AI IMAGE ANALYSIS
        const markerRegex = /\[\[\[IMAGE_ANALYSIS_REQUIRED:(.*?)\]\]\]/g;
        const matches = [...extractedText.matchAll(markerRegex)];
        if (matches.length > 0) {
          console.log(`[AI Analysis] Found ${matches.length} images to analyze...`);
          await Promise.all(matches.map(async (match) => {
            const marker = match[0];
            const imgPath = match[1].trim();
            if (fs.existsSync(imgPath)) {
              try {
                const ext = path.extname(imgPath).toLowerCase().replace(".", "");
                const mimeType = ext === "png" ? "image/png" : "image/jpeg";
                const imgData = fs.readFileSync(imgPath).toString("base64");
                const prompt = `Analyze the visual content of this slide image. If irrelevant, output "SKIP".

> 🤖 **[Visual Analysis]**
> - Visual type: {diagram|table|code|chart|photograph|mixed}
> - Content summary: {1-2 sentences}
> - Academic value: {high|medium|low|none}`;

                const result = await getModel().generateContent({
                  contents: [{ role: "user", parts: [{ text: prompt }, { inlineData: { data: imgData, mimeType } }] }],
                  generationConfig: { maxOutputTokens: 500 },
                });
                const description = result.response.text().trim();
                if (description === "SKIP") extractedText = extractedText.replace(marker, "");
                else extractedText = extractedText.replace(marker, `\n${description}\n`);
                fs.unlinkSync(imgPath);
              } catch (err) {
                console.error(`[AI Analysis Error] ${imgPath}:`, err);
                extractedText = extractedText.replace(marker, "\n[Görsel Analizi Başarısız]\n");
              }
            } else {
              extractedText = extractedText.replace(marker, "");
            }
          }));
        }

        const lesson = getLesson(lessonId);
        if (lesson) upsertLesson({ id: lessonId, slideText: extractedText });
        return res.json({ ok: true, text: extractedText });
      } catch (err: any) {
        console.error("[OCR Handler Error]:", err);
        if (!res.headersSent) return res.status(500).json({ ok: false, error: "Internal processing error", details: err.message });
      }
    });
  } catch (e: any) {
    console.error("[OCR] error:", e);
    return res.status(500).json({ ok: false, error: e.message });
  }
});

// GET /api/transcribe/stream/:jobId (SSE)
router.get("/transcribe/stream/:jobId", (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) return res.status(404).end("not found");
  res.status(200);
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  (res as any).flushHeaders?.();

  const send = (msg: any) => { res.write(`data: ${JSON.stringify(msg)}\n\n`); };
  const heartbeat = setInterval(() => { res.write(`: ping\n\n`); }, 15000);
  const onMsg = (msg: any) => send(msg);
  job.emitter.on("msg", onMsg);
  req.on("close", () => { clearInterval(heartbeat); job.emitter.off("msg", onMsg); res.end(); });
});

export default router;
