// controllers/shareController.ts
import path from "path";
import { readJSON, writeJSON, ensureDataFiles } from "../utils/file-Handler";
import { getLesson } from "./lessonControllers";
import { getWeaknessForLesson } from "./weaknessController";

export type SharedBundle = {
  shareId: string;
  createdAt: string;
  expiresAt: string;
  createdBy: string;
  lessonId: string;
  bundle: {
    title: string;
    plan: any | null;
    cheatSheet: any | null;
    quiz: string[];
    loModules: any[] | null;
    emphases: any[];
    notes: string[];
    weakTopics?: any[];
  };
  comments: Array<{ author: string; text: string; createdAt: string }>;
  accessCount: number;
};

const DATA_DIR = path.join(process.cwd(), "backend", "data");
const SHARES_PATH = path.join(DATA_DIR, "shares.json");

ensureDataFiles([{ path: SHARES_PATH, initial: [] }]);

const rid = () => `share-${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36)}`;

function loadShares(): SharedBundle[] {
  return readJSON<SharedBundle[]>(SHARES_PATH) || [];
}

function saveShares(data: SharedBundle[]) {
  writeJSON(SHARES_PATH, data);
}

// Clean expired shares
function cleanExpired(shares: SharedBundle[]): SharedBundle[] {
  const now = new Date().toISOString();
  return shares.filter((s) => s.expiresAt > now);
}

// Create a new share
export function createShare(
  lessonId: string,
  createdBy: string = "anonymous"
): SharedBundle | null {
  const lesson = getLesson(lessonId);
  if (!lesson) return null;

  const weakness = getWeaknessForLesson(lessonId);

  const share: SharedBundle = {
    shareId: rid(),
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
    createdBy,
    lessonId,
    bundle: {
      title: lesson.title,
      plan: lesson.plan || null,
      cheatSheet: lesson.cheatSheet || null,
      quiz: (lesson.quizPacks || []).map((q: any) => q.packId),
      loModules: lesson.loModules?.modules || null,
      emphases: lesson.professorEmphases || lesson.plan?.emphases || [],
      notes: [],
      weakTopics: weakness?.topics || [],
    },
    comments: [],
    accessCount: 0,
  };

  let shares = loadShares();
  shares = cleanExpired(shares);
  shares.unshift(share);
  saveShares(shares);

  return share;
}

// Get a share by ID
export function getShare(shareId: string): SharedBundle | null {
  let shares = loadShares();
  shares = cleanExpired(shares);
  const share = shares.find((s) => s.shareId === shareId);
  if (!share) return null;

  // Increment access count
  share.accessCount += 1;
  saveShares(shares);
  return share;
}

// Add comment to share
export function addComment(
  shareId: string,
  author: string,
  text: string
): SharedBundle | null {
  const shares = loadShares();
  const share = shares.find((s) => s.shareId === shareId);
  if (!share) return null;

  share.comments.push({
    author: author || "anonymous",
    text,
    createdAt: new Date().toISOString(),
  });

  saveShares(shares);
  return share;
}

// List all shares
export function listShares(): SharedBundle[] {
  let shares = loadShares();
  shares = cleanExpired(shares);
  saveShares(shares);
  return shares;
}

// Delete a share
export function deleteShare(shareId: string): boolean {
  const shares = loadShares();
  const idx = shares.findIndex((s) => s.shareId === shareId);
  if (idx < 0) return false;
  shares.splice(idx, 1);
  saveShares(shares);
  return true;
}
