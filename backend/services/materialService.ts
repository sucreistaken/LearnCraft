import path from "path";
import fs from "fs";
import { badRequest, notFound } from "../middleware/errorHandler";

const UPLOAD_DIR = path.join(process.cwd(), "backend", "data", "materials");

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

function generateId(): string {
  return `mat-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

interface MaterialData {
  id: string;
  roomId: string;
  uploadedBy: string;
  pdfPath?: string;
  audioPath?: string;
  transcript?: string;
  slideText?: string;
  createdAt: string;
}

const MATERIALS_FILE = path.join(process.cwd(), "backend", "data", "materials.json");

function readMaterials(): MaterialData[] {
  try {
    if (fs.existsSync(MATERIALS_FILE)) {
      return JSON.parse(fs.readFileSync(MATERIALS_FILE, "utf-8"));
    }
  } catch {}
  return [];
}

function writeMaterials(materials: MaterialData[]): void {
  fs.writeFileSync(MATERIALS_FILE, JSON.stringify(materials, null, 2));
}

export const materialService = {
  async create(roomId: string, uploadedBy: string): Promise<MaterialData> {
    const material: MaterialData = {
      id: generateId(),
      roomId,
      uploadedBy,
      createdAt: new Date().toISOString(),
    };
    const materials = readMaterials();
    materials.push(material);
    writeMaterials(materials);
    return material;
  },

  async getByRoom(roomId: string): Promise<MaterialData | null> {
    const materials = readMaterials();
    return materials.find((m) => m.roomId === roomId) || null;
  },

  async getById(id: string): Promise<MaterialData | null> {
    const materials = readMaterials();
    return materials.find((m) => m.id === id) || null;
  },

  async update(id: string, data: Partial<MaterialData>): Promise<MaterialData> {
    const materials = readMaterials();
    const idx = materials.findIndex((m) => m.id === id);
    if (idx === -1) throw notFound("Material not found");
    materials[idx] = { ...materials[idx], ...data };
    writeMaterials(materials);
    return materials[idx];
  },

  async setPdf(id: string, pdfPath: string, slideText?: string): Promise<MaterialData> {
    return this.update(id, { pdfPath, slideText });
  },

  async setAudio(id: string, audioPath: string, transcript?: string): Promise<MaterialData> {
    return this.update(id, { audioPath, transcript });
  },

  async deleteByRoom(roomId: string): Promise<void> {
    const materials = readMaterials();
    const filtered = materials.filter((m) => m.roomId !== roomId);
    writeMaterials(filtered);
  },
};
