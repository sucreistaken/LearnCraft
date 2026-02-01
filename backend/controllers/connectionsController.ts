// controllers/connectionsController.ts
import path from "path";
import { readJSON, writeJSON } from "../utils/file-Handler";
import { listLessons, getMemory } from "./lessonControllers";

export type ConceptConnection = {
  concept: string;
  lessonIds: string[];
  lessonTitles: string[];
  strength: number;
  relatedConcepts: string[];
  aiInsight?: string;
};

const DATA_DIR = path.join(process.cwd(), "backend", "data");
const MEMORY_PATH = path.join(DATA_DIR, "memory.json");

// Build connections by scanning all lessons
export function buildConnections(): ConceptConnection[] {
  const lessons = listLessons();
  const memory = getMemory();

  // concept -> { lessonIds, lessonTitles }
  const conceptMap = new Map<string, { lessonIds: Set<string>; lessonTitles: Set<string> }>();

  for (const lesson of lessons) {
    if (!lesson.plan) continue;

    const terms = new Set<string>();

    // From key_concepts
    if (lesson.plan.key_concepts) {
      for (const c of lesson.plan.key_concepts) {
        if (c) terms.add(c.toLowerCase().trim());
      }
    }

    // From highlights
    if (lesson.highlights) {
      for (const h of lesson.highlights) {
        if (h) terms.add(h.toLowerCase().trim());
      }
    }

    // From emphases statements
    const emphases = lesson.plan.emphases || lesson.professorEmphases || [];
    for (const e of emphases) {
      if (e.statement) {
        // Extract key phrases (simplified NLP: take first 4-5 words)
        const words = e.statement.toLowerCase().split(/\s+/).slice(0, 5).join(" ");
        if (words.length > 5) terms.add(words);
      }
    }

    // From module titles
    if (lesson.plan.modules) {
      for (const mod of lesson.plan.modules) {
        if (mod.title) terms.add(mod.title.toLowerCase().trim());
      }
    }

    // Register each term
    for (const term of terms) {
      if (!conceptMap.has(term)) {
        conceptMap.set(term, { lessonIds: new Set(), lessonTitles: new Set() });
      }
      const entry = conceptMap.get(term)!;
      entry.lessonIds.add(lesson.id);
      entry.lessonTitles.add(lesson.title);
    }
  }

  // Cross-reference with recurring concepts from memory
  const recurringSet = new Set(
    (memory.recurringConcepts || []).map((c: string) => c.toLowerCase().trim())
  );

  // Build connections for concepts appearing in 2+ lessons
  const multiLessonConnections: ConceptConnection[] = [];

  for (const [concept, data] of conceptMap) {
    if (data.lessonIds.size < 2) continue;

    // Find related concepts (co-occurring in same lessons)
    const relatedConcepts: string[] = [];
    for (const [otherConcept, otherData] of conceptMap) {
      if (otherConcept === concept) continue;
      const shared = [...data.lessonIds].filter((id) => otherData.lessonIds.has(id));
      if (shared.length > 0 && relatedConcepts.length < 5) {
        relatedConcepts.push(otherConcept);
      }
    }

    const baseFraction = data.lessonIds.size / Math.max(1, lessons.length);
    const boost = recurringSet.has(concept) ? 0.2 : 0;
    const strength = Math.min(1, Math.round((baseFraction + boost) * 100) / 100);

    multiLessonConnections.push({
      concept,
      lessonIds: [...data.lessonIds],
      lessonTitles: [...data.lessonTitles],
      strength,
      relatedConcepts,
    });
  }

  // If no cross-lesson connections, include single-lesson key concepts
  // so the feature always shows useful data
  let connections: ConceptConnection[];

  if (multiLessonConnections.length > 0) {
    connections = multiLessonConnections;
  } else {
    connections = [];
    for (const [concept, data] of conceptMap) {
      // Find related concepts within the same lesson
      const relatedConcepts: string[] = [];
      for (const [otherConcept, otherData] of conceptMap) {
        if (otherConcept === concept) continue;
        const shared = [...data.lessonIds].filter((id) => otherData.lessonIds.has(id));
        if (shared.length > 0 && relatedConcepts.length < 5) {
          relatedConcepts.push(otherConcept);
        }
      }

      const isRecurring = recurringSet.has(concept);
      const strength = Math.min(
        1,
        Math.round(((isRecurring ? 0.4 : 0.15) + relatedConcepts.length * 0.05) * 100) / 100
      );

      connections.push({
        concept,
        lessonIds: [...data.lessonIds],
        lessonTitles: [...data.lessonTitles],
        strength,
        relatedConcepts,
      });
    }
  }

  // Sort by strength descending
  connections.sort((a, b) => b.strength - a.strength);

  // Save to memory.json
  const memData = readJSON<any>(MEMORY_PATH) || {};
  memData.connections = connections;
  writeJSON(MEMORY_PATH, memData);

  return connections;
}

// Get existing connections
export function getConnections(): ConceptConnection[] {
  const memData = readJSON<any>(MEMORY_PATH) || {};
  return memData.connections || [];
}
