import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai";

let _model: GenerativeModel | null = null;

export function getModel(): GenerativeModel {
  if (!_model) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error("GEMINI_API_KEY is not set");
    const genAI = new GoogleGenerativeAI(key);
    _model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  }
  return _model;
}

export const stripCodeFences = (s: string) =>
  s.replace(/```json/gi, "").replace(/```/g, "").trim();

export const tryParseJSON = (s: string) => {
  try { return JSON.parse(s); } catch { return null; }
};
