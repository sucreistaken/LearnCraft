import path from "path";
import { BaseRepository } from "../repositories/baseRepository";

export interface Job {
  id: string;
  type: string;
  payload: any;
  status: "pending" | "processing" | "completed" | "failed";
  result?: any;
  error?: string;
  attempts: number;
  maxAttempts: number;
  createdAt: string;
  processedAt?: string;
}

const DATA_DIR = path.join(__dirname, "..", "data");

class JobQueue {
  private repo = new BaseRepository<Job>(path.join(DATA_DIR, "queue.json"));

  async add(type: string, payload: any, maxAttempts = 3): Promise<Job> {
    const job: Job = {
      id: `job-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      type,
      payload,
      status: "pending",
      attempts: 0,
      maxAttempts,
      createdAt: new Date().toISOString(),
    };
    return this.repo.create(job);
  }

  async getPending(): Promise<Job[]> {
    return this.repo.findBy((j) => j.status === "pending");
  }

  async markProcessing(id: string): Promise<Job | null> {
    return this.repo.update(id, {
      status: "processing",
      processedAt: new Date().toISOString(),
    } as Partial<Job>);
  }

  async markCompleted(id: string, result?: any): Promise<Job | null> {
    return this.repo.update(id, { status: "completed", result } as Partial<Job>);
  }

  async markFailed(id: string, error: string): Promise<Job | null> {
    const job = await this.repo.findById(id);
    if (!job) return null;

    const attempts = job.attempts + 1;
    const status = attempts >= job.maxAttempts ? "failed" : "pending";
    return this.repo.update(id, { status, error, attempts } as Partial<Job>);
  }

  async cleanup(olderThanMs = 24 * 60 * 60 * 1000): Promise<number> {
    const cutoff = new Date(Date.now() - olderThanMs).toISOString();
    const old = await this.repo.findBy(
      (j) => (j.status === "completed" || j.status === "failed") && j.createdAt < cutoff
    );
    for (const j of old) await this.repo.delete(j.id);
    return old.length;
  }
}

export const jobQueue = new JobQueue();
