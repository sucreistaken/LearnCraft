// backend/utils/fileHandler.ts
import fs from "fs";
import path from "path";

export const ensureDir = (dirPath: string) => {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
};

export const readJSON = <T = any>(filePath: string): T | null => {
  try {
    if (!fs.existsSync(filePath)) return null;
    const data = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(data) as T;
  } catch (e) {
    console.error("readJSON error:", e);
    return null;
  }
};

export const writeJSON = (filePath: string, data: unknown) => {
  try {
    ensureDir(path.dirname(filePath));
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
  } catch (e) {
    console.error("writeJSON error:", e);
  }
};

export const ensureDataFiles = (files: Array<{ path: string; initial: any }>) => {
  for (const f of files) {
    ensureDir(path.dirname(f.path));
    if (!fs.existsSync(f.path)) {
      writeJSON(f.path, f.initial);
    }
  }
};
