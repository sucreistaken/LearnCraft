import { jobQueue, Job } from "./jobQueue";

type JobHandler = (payload: any) => Promise<any>;

const handlers = new Map<string, JobHandler>();

export function registerJobHandler(type: string, handler: JobHandler): void {
  handlers.set(type, handler);
}

let running = false;
let intervalId: ReturnType<typeof setInterval> | null = null;

async function processNext(): Promise<void> {
  if (running) return;
  running = true;

  try {
    const pending = await jobQueue.getPending();
    if (pending.length === 0) return;

    const job = pending[0];
    const handler = handlers.get(job.type);
    if (!handler) {
      await jobQueue.markFailed(job.id, `No handler for job type: ${job.type}`);
      return;
    }

    await jobQueue.markProcessing(job.id);

    try {
      const result = await handler(job.payload);
      await jobQueue.markCompleted(job.id, result);
    } catch (err: any) {
      await jobQueue.markFailed(job.id, err.message || "Unknown error");
    }
  } finally {
    running = false;
  }
}

export function startJobProcessor(intervalMs = 2000): void {
  if (intervalId) return;
  intervalId = setInterval(processNext, intervalMs);
  console.log(`[JobProcessor] Started (interval: ${intervalMs}ms)`);
}

export function stopJobProcessor(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log("[JobProcessor] Stopped");
  }
}
