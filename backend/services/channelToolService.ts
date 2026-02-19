import {
  channelToolRepo,
  ChannelToolData,
  QuizQuestion,
  FlashcardItem,
  DeepDiveMessage,
  NoteItem,
} from "../repositories/channelToolRepo";
import { getModel, stripCodeFences } from "./aiService";
import { channelService } from "./channelService";
import { getLesson } from "../controllers/lessonControllers";

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ── Token utilities (from contextAssembler.ts pattern) ────────────────────────
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function trimToTokenBudget(text: string, budget: number): string {
  const charBudget = budget * 4;
  if (text.length <= charBudget) return text;
  return text.slice(0, charBudget) + "...";
}

// ── LessonContextMeta (returned to frontend) ─────────────────────────────────
interface LessonContextMeta {
  lessonTitle: string;
  hasTranscript: boolean;
  hasSlides: boolean;
  hasCheatSheet: boolean;
  hasLoModules: boolean;
  hasLearningOutcomes: boolean;
  emphasesCount: number;
  modulesCount: number;
  loModuleCount: number;
  quickQuizCount: number;
  miniQuizCount: number;
  mustRememberCount: number;
  formulaCount: number;
  pitfallCount: number;
  sourcesSummary: string;
}

// Tool-specific token budgets
const TOKEN_BUDGETS: Record<string, Record<string, number>> = {
  quiz:        { transcript: 3000, slides: 2000, emphases: 2000, cheatSheet: 1500, loModules: 2000, keyConcepts: 500 },
  flashcards:  { transcript: 2000, slides: 1500, emphases: 2000, cheatSheet: 2000, loModules: 3000, keyConcepts: 500 },
  "deep-dive": { transcript: 4000, slides: 2000, emphases: 1500, cheatSheet: 2000, loModules: 1500, keyConcepts: 500 },
  "mind-map":  { transcript: 2000, slides: 1500, emphases: 1500, cheatSheet: 1000, loModules: 2000, keyConcepts: 1000 },
};

async function buildToolContext(
  channelId: string,
  toolType: "quiz" | "flashcards" | "deep-dive" | "mind-map"
): Promise<{ context: string; meta: LessonContextMeta } | null> {
  try {
    const channel = await channelService.getByIdGlobal(channelId);
    if (!channel.lessonId) return null;

    const lesson = getLesson(channel.lessonId);
    if (!lesson) return null;

    const budgets = TOKEN_BUDGETS[toolType] || TOKEN_BUDGETS.quiz;
    const parts: string[] = [];
    const sources: string[] = [];

    parts.push(`=== LESSON: ${lesson.title} ===`);

    // 1. Transcript
    if (lesson.transcript) {
      parts.push(`=== TRANSCRIPT ===\n${trimToTokenBudget(lesson.transcript, budgets.transcript)}`);
      sources.push("transcript");
    }

    // 2. Slides
    if (lesson.slideText) {
      parts.push(`=== SLIDES ===\n${trimToTokenBudget(lesson.slideText, budgets.slides)}`);
      sources.push("slides");
    }

    // 3. Emphases (sorted by confidence, include evidence)
    const emphases = lesson.professorEmphases || [];
    if (emphases.length > 0) {
      const sorted = [...emphases].sort((a: any, b: any) => (b.confidence || 0) - (a.confidence || 0));
      const emphasisParts: string[] = [];
      let tokensUsed = 0;
      for (const e of sorted) {
        const line = `- [${(e.confidence * 100).toFixed(0)}%] ${e.statement}\n  Why: ${e.why}\n  Evidence: ${e.evidence || "N/A"}`;
        const lineTok = estimateTokens(line);
        if (tokensUsed + lineTok > budgets.emphases) break;
        emphasisParts.push(line);
        tokensUsed += lineTok;
      }
      if (emphasisParts.length > 0) {
        parts.push(`=== PROFESSOR EMPHASES (${emphasisParts.length}/${emphases.length}) ===\n${emphasisParts.join("\n")}`);
        sources.push(`${emphasisParts.length} emphases`);
      }
    }

    // 4. Key Concepts
    if (lesson.plan?.key_concepts?.length) {
      const conceptsText = lesson.plan.key_concepts.join(", ");
      parts.push(`=== KEY CONCEPTS ===\n${trimToTokenBudget(conceptsText, budgets.keyConcepts)}`);
      sources.push("key concepts");
    }

    // 5. Modules
    if (lesson.plan?.modules?.length) {
      const modulesSummary = lesson.plan.modules
        .map((m: any, i: number) => `${i + 1}. ${m.title}: ${m.goal || ""}`)
        .join("\n");
      parts.push(`=== MODULES ===\n${modulesSummary}`);
    }

    // 6. CheatSheet
    const cs = lesson.cheatSheet;
    if (cs) {
      const csParts: string[] = [];
      if (cs.sections?.length) {
        const sectionsText = cs.sections
          .map((s: any) => `## ${s.heading}\n${(s.bullets || []).map((b: string) => `- ${b}`).join("\n")}`)
          .join("\n\n");
        csParts.push(sectionsText);
      }
      if (cs.formulas?.length) {
        csParts.push(`## Formulas\n${cs.formulas.map((f: string) => `- ${f}`).join("\n")}`);
      }
      if (cs.pitfalls?.length) {
        csParts.push(`## Common Pitfalls\n${cs.pitfalls.map((p: string) => `- ${p}`).join("\n")}`);
      }
      if (cs.quickQuiz?.length) {
        csParts.push(`## Quick Q&A\n${cs.quickQuiz.map((qa: any) => `Q: ${qa.q}\nA: ${qa.a}`).join("\n\n")}`);
      }
      if (csParts.length > 0) {
        parts.push(`=== CHEAT SHEET ===\n${trimToTokenBudget(csParts.join("\n\n"), budgets.cheatSheet)}`);
        sources.push("cheat sheet");
      }
    }

    // 7. LO Modules
    const loMods = lesson.loModules?.modules;
    if (loMods?.length) {
      const loParts: string[] = [];
      let tokensUsed = 0;
      for (const mod of loMods) {
        const lines: string[] = [];
        lines.push(`## ${mod.loId}: ${mod.loTitle}`);
        lines.push(`Gist: ${mod.oneLineGist}`);
        if (mod.coreIdeas?.length) lines.push(`Core Ideas: ${mod.coreIdeas.join("; ")}`);
        if (mod.mustRemember?.length) lines.push(`Must Remember: ${mod.mustRemember.join("; ")}`);
        if (mod.commonTraps?.length) lines.push(`Common Traps: ${mod.commonTraps.join("; ")}`);
        if (mod.miniQuiz?.length) {
          lines.push(`Mini Quiz:\n${mod.miniQuiz.map((mq: any) => `  Q: ${mq.question}\n  A: ${mq.answer}`).join("\n")}`);
        }
        const block = lines.join("\n");
        const blockTok = estimateTokens(block);
        if (tokensUsed + blockTok > budgets.loModules) break;
        loParts.push(block);
        tokensUsed += blockTok;
      }
      if (loParts.length > 0) {
        parts.push(`=== LO STUDY MODULES (${loParts.length}/${loMods.length}) ===\n${loParts.join("\n\n")}`);
        sources.push(`${loParts.length} LO modules`);
      }
    }

    // 8. Learning Outcomes
    const los = lesson.plan?.learning_outcomes;
    if (los?.length) {
      const loText = los.map((lo: any) => `- ${lo.code}: ${lo.description}`).join("\n");
      parts.push(`=== LEARNING OUTCOMES ===\n${loText}`);
      sources.push("learning outcomes");
    }

    // Build meta
    const meta: LessonContextMeta = {
      lessonTitle: lesson.title,
      hasTranscript: !!(lesson.transcript && lesson.transcript.length > 0),
      hasSlides: !!(lesson.slideText && lesson.slideText.length > 0),
      hasCheatSheet: !!cs,
      hasLoModules: !!(loMods && loMods.length > 0),
      hasLearningOutcomes: !!(los && los.length > 0),
      emphasesCount: emphases.length,
      modulesCount: lesson.plan?.modules?.length || 0,
      loModuleCount: loMods?.length || 0,
      quickQuizCount: cs?.quickQuiz?.length || 0,
      miniQuizCount: loMods?.reduce((sum: number, m: any) => sum + (m.miniQuiz?.length || 0), 0) || 0,
      mustRememberCount: loMods?.reduce((sum: number, m: any) => sum + (m.mustRemember?.length || 0), 0) || 0,
      formulaCount: cs?.formulas?.length || 0,
      pitfallCount: cs?.pitfalls?.length || 0,
      sourcesSummary: sources.join(" + "),
    };

    return { context: parts.join("\n\n"), meta };
  } catch {
    return null;
  }
}

export const channelToolService = {
  // ── Get data ────────────────────────────────────────────────────────────────
  getData(channelId: string): ChannelToolData {
    return channelToolRepo.load(channelId);
  },

  // ── Quiz: generate ──────────────────────────────────────────────────────────
  async generateQuiz(
    channelId: string,
    topic: string,
    serverName: string,
    count: number = 10,
    options?: { difficulty?: 'easy' | 'medium' | 'hard'; includeTrueFalse?: boolean }
  ) {
    const data = channelToolRepo.load(channelId);
    const difficulty = options?.difficulty || 'medium';
    const includeTF = options?.includeTrueFalse ?? true;

    try {
      const toolCtx = await buildToolContext(channelId, "quiz");

      const difficultyGuide = {
        easy: 'Focus on basic definitions, simple recall, and straightforward concepts. Questions should be answerable by someone who just read the material once.',
        medium: 'Mix of recall and application questions. Include some questions that require understanding relationships between concepts.',
        hard: 'Focus on analysis, application to novel scenarios, and tricky edge cases. Include questions that require deep understanding.',
      }[difficulty];

      const tfInstruction = includeTF
        ? `Include 2-3 True/False questions. For T/F questions, use options: ["True", "False"] with correctIndex 0 for True, 1 for False.`
        : 'All questions should be multiple choice with 4 options.';

      const contextBlock = toolCtx
        ? `Based on the following lecture material, generate questions that test understanding of the actual content:\n\n${toolCtx.context}\n\n`
        : '';

      const prompt = `${contextBlock}Generate exactly ${count} quiz questions about '${topic}' for a university study group '${serverName}'.

DIFFICULTY: ${difficulty.toUpperCase()}
${difficultyGuide}

${tfInstruction}

Return ONLY a JSON array with this schema:
[{
  "question": "string",
  "options": ["string array - 4 items for MC, 2 for T/F"],
  "correctIndex": number,
  "explanation": "Detailed explanation of WHY this answer is correct and others are wrong (2-3 sentences)",
  "type": "mc" or "tf",
  "difficulty": "${difficulty}"
}]

RULES:
- Each explanation must teach something, not just state the answer
- Options should be plausible (no obvious wrong answers)
- Questions should cover different aspects of the topic
${toolCtx ? `- Questions MUST be based on the provided lecture material
- Use professor emphases to create WHY-type questions that test deeper understanding
- Use cheat sheet quickQuiz items for factual recall questions
- Reference learning outcomes in explanations where relevant` : ''}
- Return ONLY valid JSON array`;

      const result = await getModel().generateContent(prompt);
      const text = result.response.text();
      const parsed = JSON.parse(stripCodeFences(text));

      const questions: QuizQuestion[] = (Array.isArray(parsed) ? parsed : []).map((q: any) => ({
        id: generateId(),
        question: q.question,
        options: q.options,
        correctIndex: q.correctIndex,
        explanation: q.explanation || '',
        type: q.type || (q.options?.length === 2 ? 'tf' : 'mc'),
        difficulty: q.difficulty || difficulty,
      }));

      data.quiz = {
        questions,
        scores: {},
        generatedAt: new Date().toISOString(),
      };

      channelToolRepo.save(channelId, data);
      return { data, sourcesSummary: toolCtx?.meta.sourcesSummary || null };
    } catch (err) {
      console.error("channelToolService.generateQuiz error:", err);
      throw new Error("Failed to generate quiz");
    }
  },

  // ── Quiz: answer ────────────────────────────────────────────────────────────
  answerQuiz(
    channelId: string,
    userId: string,
    nickname: string,
    questionId: string,
    selectedIndex: number
  ) {
    const data = channelToolRepo.load(channelId);

    if (!data.quiz || !data.quiz.questions.length) {
      throw new Error("No quiz available");
    }

    const question = data.quiz.questions.find((q) => q.id === questionId);
    if (!question) {
      throw new Error("Question not found");
    }

    const correct = selectedIndex === question.correctIndex;

    if (!data.quiz.scores[userId]) {
      data.quiz.scores[userId] = { correct: 0, total: 0, nickname };
    }

    data.quiz.scores[userId].total += 1;
    if (correct) {
      data.quiz.scores[userId].correct += 1;
    }

    channelToolRepo.save(channelId, data);

    return {
      correct,
      correctIndex: question.correctIndex,
      explanation: question.explanation,
      scores: data.quiz.scores,
    };
  },

  // ── Flashcards: add manually ────────────────────────────────────────────────
  addFlashcard(
    channelId: string,
    front: string,
    back: string,
    topic: string,
    userId: string,
    nickname: string
  ): FlashcardItem {
    const data = channelToolRepo.load(channelId);

    if (!data.flashcards) {
      data.flashcards = { cards: [] };
    }

    const card: FlashcardItem = {
      id: generateId(),
      front,
      back,
      topic,
      createdBy: userId,
      createdByNickname: nickname,
      createdAt: new Date().toISOString(),
      votes: [],
      source: "manual",
    };

    data.flashcards.cards.push(card);
    channelToolRepo.save(channelId, data);

    return card;
  },

  // ── Flashcards: generate with AI ────────────────────────────────────────────
  async generateFlashcards(
    channelId: string,
    topic: string,
    serverName: string,
    count: number = 8
  ): Promise<{ cards: FlashcardItem[]; sourcesSummary: string | null }> {
    const data = channelToolRepo.load(channelId);

    if (!data.flashcards) {
      data.flashcards = { cards: [] };
    }

    try {
      const toolCtx = await buildToolContext(channelId, "flashcards");

      const contextBlock = toolCtx
        ? `Based on the following lecture material, generate flashcards that cover the actual content:\n\n${toolCtx.context}\n\n`
        : '';

      const prompt = `${contextBlock}Generate ${count} high-quality flashcards about '${topic}' for a university study group '${serverName}'.

Return ONLY a JSON array with this schema:
[{
  "front": "Clear, concise question or concept",
  "back": "Detailed answer or explanation",
  "hint": "A brief visual or mnemonic hint to help recall (1 short sentence)",
  "topic": "Sub-topic category"
}]

RULES:
- Each card should test a different concept
- Hints should use analogies, mnemonics, or visual imagery
- Back should be educational, not just a one-word answer
${toolCtx ? `- Flashcards MUST be based on the provided lecture material
- Cover professor emphases, formulas, and mustRemember facts
- Use cheat sheet pitfalls for misconception-awareness cards
- Include cards that test understanding of common traps and errors` : ''}
- Return ONLY valid JSON array`;

      const result = await getModel().generateContent(prompt);
      const text = result.response.text();
      const parsed = JSON.parse(stripCodeFences(text)) as Array<{
        front: string;
        back: string;
        hint?: string;
        topic: string;
      }>;

      const newCards: FlashcardItem[] = parsed.map((c) => ({
        id: generateId(),
        front: c.front,
        back: c.back,
        hint: c.hint || undefined,
        topic: c.topic || topic,
        createdBy: "ai",
        createdByNickname: "Study AI",
        createdAt: new Date().toISOString(),
        votes: [],
        source: "ai-generated" as const,
      }));

      data.flashcards.cards.push(...newCards);
      channelToolRepo.save(channelId, data);

      return { cards: newCards, sourcesSummary: toolCtx?.meta.sourcesSummary || null };
    } catch (err) {
      console.error("channelToolService.generateFlashcards error:", err);
      throw new Error("Failed to generate flashcards");
    }
  },

  // ── Flashcards: extract from lesson (no AI) ───────────────────────────────
  async extractFlashcardsFromLesson(channelId: string): Promise<{
    cards: FlashcardItem[];
    summary: { emphases: number; quickQuiz: number; miniQuiz: number; mustRemember: number; total: number };
  }> {
    const channel = await channelService.getByIdGlobal(channelId);
    if (!channel.lessonId) throw new Error("No lesson linked");

    const lesson = getLesson(channel.lessonId);
    if (!lesson) throw new Error("Lesson not found");

    const data = channelToolRepo.load(channelId);
    if (!data.flashcards) data.flashcards = { cards: [] };

    const existingFronts = new Set(data.flashcards.cards.map((c) => c.front));
    const newCards: FlashcardItem[] = [];
    const summary = { emphases: 0, quickQuiz: 0, miniQuiz: 0, mustRemember: 0, total: 0 };

    // 1. From emphases
    const emphases = lesson.professorEmphases || [];
    for (const e of emphases) {
      const front = e.statement;
      if (front && !existingFronts.has(front)) {
        newCards.push({
          id: generateId(),
          front,
          back: `Why: ${e.why || "Important concept"}\nEvidence: ${e.evidence || "Professor emphasis"}`,
          topic: "Professor Emphasis",
          createdBy: "system",
          createdByNickname: "Lesson Extract",
          createdAt: new Date().toISOString(),
          votes: [],
          source: "lesson-emphasis",
        });
        existingFronts.add(front);
        summary.emphases++;
      }
    }

    // 2. From cheatSheet.quickQuiz
    if (lesson.cheatSheet?.quickQuiz) {
      for (const qa of lesson.cheatSheet.quickQuiz) {
        if (qa.q && !existingFronts.has(qa.q)) {
          newCards.push({
            id: generateId(),
            front: qa.q,
            back: qa.a,
            topic: "Cheat Sheet",
            createdBy: "system",
            createdByNickname: "Lesson Extract",
            createdAt: new Date().toISOString(),
            votes: [],
            source: "lesson-cheatsheet",
          });
          existingFronts.add(qa.q);
          summary.quickQuiz++;
        }
      }
    }

    // 3. From LO modules miniQuiz
    if (lesson.loModules?.modules) {
      for (const mod of lesson.loModules.modules) {
        if (mod.miniQuiz) {
          for (const mq of mod.miniQuiz) {
            if (mq.question && !existingFronts.has(mq.question)) {
              newCards.push({
                id: generateId(),
                front: mq.question,
                back: `${mq.answer}\n\nWhy: ${mq.why}`,
                topic: mod.loTitle || mod.loId,
                createdBy: "system",
                createdByNickname: "Lesson Extract",
                createdAt: new Date().toISOString(),
                votes: [],
                source: "lesson-miniQuiz",
              });
              existingFronts.add(mq.question);
              summary.miniQuiz++;
            }
          }
        }

        // 4. From mustRemember
        if (mod.mustRemember) {
          for (const fact of mod.mustRemember) {
            if (fact && !existingFronts.has(fact)) {
              const words = fact.split(" ");
              let front: string;
              let back: string;
              if (words.length > 3) {
                const blankIdx = Math.floor(words.length / 2);
                const blanked = [...words];
                back = blanked[blankIdx];
                blanked[blankIdx] = "______";
                front = `Fill in the blank: ${blanked.join(" ")}`;
              } else {
                front = `What is: ${fact}?`;
                back = fact;
              }
              newCards.push({
                id: generateId(),
                front,
                back,
                topic: mod.loTitle || mod.loId,
                createdBy: "system",
                createdByNickname: "Lesson Extract",
                createdAt: new Date().toISOString(),
                votes: [],
                source: "lesson-loModule",
              });
              existingFronts.add(fact);
              summary.mustRemember++;
            }
          }
        }
      }
    }

    summary.total = newCards.length;

    if (newCards.length > 0) {
      data.flashcards.cards.push(...newCards);
      channelToolRepo.save(channelId, data);
    }

    return { cards: newCards, summary };
  },

  // ── Flashcards: SM-2 review ─────────────────────────────────────────────────
  reviewFlashcard(
    channelId: string,
    cardId: string,
    userId: string,
    quality: number // 0-5 SM-2 quality rating
  ): FlashcardItem | null {
    const data = channelToolRepo.load(channelId);
    if (!data.flashcards) return null;

    const card = data.flashcards.cards.find(c => c.id === cardId);
    if (!card) return null;

    if (!card.sm2) card.sm2 = {};

    const prev = card.sm2[userId] || {
      easeFactor: 2.5,
      interval: 0,
      repetitions: 0,
      nextReview: new Date().toISOString(),
      lastReview: new Date().toISOString(),
    };

    // SM-2 algorithm
    let { easeFactor, interval, repetitions } = prev;

    if (quality >= 3) {
      // Correct response
      if (repetitions === 0) {
        interval = 1;
      } else if (repetitions === 1) {
        interval = 6;
      } else {
        interval = Math.round(interval * easeFactor);
      }
      repetitions += 1;
    } else {
      // Incorrect - reset
      repetitions = 0;
      interval = 1;
    }

    // Update ease factor
    easeFactor = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    if (easeFactor < 1.3) easeFactor = 1.3;

    const now = new Date();
    const nextReview = new Date(now.getTime() + interval * 24 * 60 * 60 * 1000);

    card.sm2[userId] = {
      easeFactor: Math.round(easeFactor * 100) / 100,
      interval,
      repetitions,
      nextReview: nextReview.toISOString(),
      lastReview: now.toISOString(),
    };

    channelToolRepo.save(channelId, data);
    return card;
  },

  // ── Deep Dive: chat ─────────────────────────────────────────────────────────
  async deepDiveChat(
    channelId: string,
    text: string,
    userId: string,
    nickname: string,
    topic: string,
    serverName: string
  ): Promise<{ userMessage: DeepDiveMessage; aiMessage: DeepDiveMessage }> {
    const data = channelToolRepo.load(channelId);

    if (!data.deepDive) {
      data.deepDive = { messages: [] };
    }

    // Add user message
    const userMessage: DeepDiveMessage = {
      id: generateId(),
      role: "user",
      text,
      authorId: userId,
      authorNickname: nickname,
      timestamp: new Date().toISOString(),
    };
    data.deepDive.messages.push(userMessage);

    // Build context from recent messages
    const recentMessages = data.deepDive.messages.slice(-20);
    const context = recentMessages
      .map((m) => `${m.authorNickname} (${m.role}): ${m.text}`)
      .join("\n");

    try {
      const toolCtx = await buildToolContext(channelId, "deep-dive");

      let lessonBlock = '';
      if (toolCtx) {
        const extraInstructions: string[] = [];

        // Extract pitfalls for warning
        const lesson = getLesson((await channelService.getByIdGlobal(channelId)).lessonId!);
        if (lesson?.cheatSheet?.pitfalls?.length) {
          extraInstructions.push(`Common mistakes to warn about:\n${lesson.cheatSheet.pitfalls.map((p: string) => `- ${p}`).join("\n")}`);
        }
        if (lesson?.loModules?.modules) {
          const traps = lesson.loModules.modules.flatMap((m: any) => m.commonTraps || []);
          if (traps.length > 0) {
            extraInstructions.push(`Student misconceptions:\n${traps.map((t: string) => `- ${t}`).join("\n")}`);
          }
        }
        if (lesson?.cheatSheet?.formulas?.length) {
          extraInstructions.push(`Key formulas to reference:\n${lesson.cheatSheet.formulas.map((f: string) => `- ${f}`).join("\n")}`);
        }

        lessonBlock = `\n\nYou have access to the following lecture material. Use it to give accurate, specific answers:\n\n${toolCtx.context}`;
        if (extraInstructions.length > 0) {
          lessonBlock += `\n\n=== SPECIAL INSTRUCTIONS ===\n${extraInstructions.join("\n\n")}`;
        }
        lessonBlock += '\n\n';
      }

      const prompt = `You are a study assistant for '${serverName}' helping with '${topic}'.${lessonBlock} Answer clearly and educationally. Previous conversation: ${context}\n\nStudent ${nickname} asks: ${text}`;

      const result = await getModel().generateContent(prompt);
      const aiText = result.response.text();

      const aiMessage: DeepDiveMessage = {
        id: generateId(),
        role: "assistant",
        text: aiText,
        authorId: "ai",
        authorNickname: "Study AI",
        timestamp: new Date().toISOString(),
      };
      data.deepDive.messages.push(aiMessage);

      channelToolRepo.save(channelId, data);

      return { userMessage, aiMessage };
    } catch (err) {
      console.error("channelToolService.deepDiveChat error:", err);
      throw new Error("Failed to generate AI response");
    }
  },

  // ── Mind Map: generate ──────────────────────────────────────────────────────
  async generateMindMap(
    channelId: string,
    topic: string,
    serverName: string
  ) {
    const data = channelToolRepo.load(channelId);

    try {
      const toolCtx = await buildToolContext(channelId, "mind-map");

      let contextBlock = '';
      if (toolCtx) {
        const lesson = getLesson((await channelService.getByIdGlobal(channelId)).lessonId!);
        const structureHints: string[] = [];
        if (lesson?.plan?.modules?.length) {
          structureHints.push(`Use these as main branches: ${lesson.plan.modules.map((m: any) => m.title).join(", ")}`);
        }
        if (lesson?.plan?.key_concepts?.length) {
          structureHints.push(`Connecting themes: ${lesson.plan.key_concepts.join(", ")}`);
        }
        contextBlock = `Based on the following lecture material, create a mind map that reflects the actual content structure:\n\n${toolCtx.context}\n\n`;
        if (structureHints.length > 0) {
          contextBlock += `STRUCTURE HINTS:\n${structureHints.join("\n")}\n\n`;
        }
      }

      const prompt = `${contextBlock}Create a Mermaid.js mindmap diagram about '${topic}' for study group '${serverName}'. Use \`mindmap\` syntax. Return ONLY the Mermaid code, no markdown fences.`;

      const result = await getModel().generateContent(prompt);
      const rawText = result.response.text();
      const mermaidCode = stripCodeFences(rawText);

      data.mindMap = {
        mermaidCode,
        generatedAt: new Date().toISOString(),
        topic,
      };

      channelToolRepo.save(channelId, data);

      return { mindMap: data.mindMap, sourcesSummary: toolCtx?.meta.sourcesSummary || null };
    } catch (err) {
      console.error("channelToolService.generateMindMap error:", err);
      throw new Error("Failed to generate mind map");
    }
  },

  // ── Get lesson context meta (for frontend badges) ─────────────────────────
  async getLessonContextMeta(channelId: string): Promise<LessonContextMeta | null> {
    const result = await buildToolContext(channelId, "quiz"); // toolType doesn't matter for meta
    return result?.meta || null;
  },

  // ── Sprint: start ───────────────────────────────────────────────────────────
  startSprint(
    channelId: string,
    studyMin: number,
    breakMin: number,
    userId: string,
    nickname: string
  ) {
    const data = channelToolRepo.load(channelId);

    const now = new Date().toISOString();

    data.sprint = {
      phase: "studying",
      studyDurationMin: studyMin,
      breakDurationMin: breakMin,
      startedAt: now,
      currentPhaseStartedAt: now,
      pomodorosCompleted: data.sprint?.pomodorosCompleted || 0,
      members: {
        ...(data.sprint?.members || {}),
        [userId]: {
          status: "studying",
          lastUpdate: now,
          nickname,
        },
      },
    };

    channelToolRepo.save(channelId, data);

    return data.sprint;
  },

  // ── Sprint: update member status ────────────────────────────────────────────
  updateSprintStatus(
    channelId: string,
    userId: string,
    nickname: string,
    status: string
  ) {
    const data = channelToolRepo.load(channelId);

    if (!data.sprint) {
      data.sprint = {
        phase: "idle",
        studyDurationMin: 25,
        breakDurationMin: 5,
        pomodorosCompleted: 0,
        members: {},
      };
    }

    data.sprint.members[userId] = {
      status,
      lastUpdate: new Date().toISOString(),
      nickname,
    };

    channelToolRepo.save(channelId, data);

    return data.sprint;
  },

  // ── Notes: add ──────────────────────────────────────────────────────────────
  addNote(
    channelId: string,
    title: string,
    content: string,
    category: NoteItem["category"],
    userId: string,
    nickname: string
  ): NoteItem {
    const data = channelToolRepo.load(channelId);

    if (!data.notes) {
      data.notes = { items: [] };
    }

    const note: NoteItem = {
      id: generateId(),
      title,
      content,
      category,
      authorId: userId,
      authorNickname: nickname,
      createdAt: new Date().toISOString(),
      pinned: false,
    };

    data.notes.items.push(note);
    channelToolRepo.save(channelId, data);

    return note;
  },

  // ── Notes: edit ─────────────────────────────────────────────────────────────
  editNote(
    channelId: string,
    noteId: string,
    updates: { title?: string; content?: string; category?: string }
  ): NoteItem | null {
    const data = channelToolRepo.load(channelId);

    if (!data.notes) return null;

    const note = data.notes.items.find((n) => n.id === noteId);
    if (!note) return null;

    if (updates.title !== undefined) note.title = updates.title;
    if (updates.content !== undefined) note.content = updates.content;
    if (updates.category !== undefined) note.category = updates.category as NoteItem["category"];
    note.editedAt = new Date().toISOString();

    channelToolRepo.save(channelId, data);

    return note;
  },

  // ── Notes: delete ───────────────────────────────────────────────────────────
  deleteNote(channelId: string, noteId: string): boolean {
    const data = channelToolRepo.load(channelId);

    if (!data.notes) return false;

    const before = data.notes.items.length;
    data.notes.items = data.notes.items.filter((n) => n.id !== noteId);

    if (data.notes.items.length === before) return false;

    channelToolRepo.save(channelId, data);
    return true;
  },

  // ── Notes: pin/unpin ────────────────────────────────────────────────────────
  pinNote(channelId: string, noteId: string): NoteItem | null {
    const data = channelToolRepo.load(channelId);

    if (!data.notes) return null;

    const note = data.notes.items.find((n) => n.id === noteId);
    if (!note) return null;

    note.pinned = !note.pinned;
    channelToolRepo.save(channelId, data);

    return note;
  },

  // ── Lock mode ─────────────────────────────────────────────────────────────
  lockTool(channelId: string, userId: string): { locked: boolean; lockedBy: string } {
    const data = channelToolRepo.load(channelId);
    (data as any).locked = true;
    (data as any).lockedBy = userId;
    channelToolRepo.save(channelId, data);
    return { locked: true, lockedBy: userId };
  },

  unlockTool(channelId: string): { locked: boolean; lockedBy: string | null } {
    const data = channelToolRepo.load(channelId);
    (data as any).locked = false;
    (data as any).lockedBy = null;
    channelToolRepo.save(channelId, data);
    return { locked: false, lockedBy: null };
  },

  getToolLockStatus(channelId: string): { locked: boolean; lockedBy: string | null } {
    const data = channelToolRepo.load(channelId);
    return { locked: !!(data as any).locked, lockedBy: (data as any).lockedBy || null };
  },
};
