import { Request, Response } from "express";
import { channelToolService } from "../services/channelToolService";
import { listLessons, getLesson } from "./lessonControllers";
import { channelService } from "../services/channelService";
import { channelRepo } from "../repositories/channelRepo";

export const channelToolController = {
  async getToolData(req: Request, res: Response) {
    try {
      const data = await channelToolService.getData(req.params.channelId);
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  async generateQuiz(req: Request, res: Response) {
    try {
      const { topic, serverName, count, difficulty, includeTrueFalse } = req.body;
      const { data, sourcesSummary } = await channelToolService.generateQuiz(
        req.params.channelId,
        topic,
        serverName,
        count || 10,
        { difficulty, includeTrueFalse }
      );
      res.json({ ok: true, data, sourcesSummary });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  async answerQuiz(req: Request, res: Response) {
    try {
      const { userId, nickname, questionId, selectedIndex } = req.body;
      const result = await channelToolService.answerQuiz(
        req.params.channelId,
        userId,
        nickname,
        questionId,
        selectedIndex
      );
      res.json({ ok: true, result });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  async addFlashcard(req: Request, res: Response) {
    try {
      const { front, back, topic, userId, nickname } = req.body;
      const card = await channelToolService.addFlashcard(
        req.params.channelId,
        front,
        back,
        topic,
        userId,
        nickname
      );
      res.json({ ok: true, card });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  async generateFlashcards(req: Request, res: Response) {
    try {
      const { topic, serverName, count } = req.body;
      const { cards, sourcesSummary } = await channelToolService.generateFlashcards(
        req.params.channelId,
        topic,
        serverName,
        count
      );
      res.json({ ok: true, cards, sourcesSummary });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  async extractFlashcards(req: Request, res: Response) {
    try {
      const result = await channelToolService.extractFlashcardsFromLesson(
        req.params.channelId
      );
      res.json({ ok: true, ...result });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  async reviewFlashcard(req: Request, res: Response) {
    try {
      const { channelId } = req.params;
      const { cardId, userId, quality } = req.body;

      if (!cardId || !userId || quality === undefined) {
        return res.status(400).json({ error: "Missing cardId, userId, or quality" });
      }

      const q = Math.max(0, Math.min(5, Number(quality)));
      const card = channelToolService.reviewFlashcard(channelId, cardId, userId, q);

      if (!card) {
        return res.status(404).json({ error: "Card not found" });
      }

      res.json({ ok: true, card });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  async deepDiveChat(req: Request, res: Response) {
    try {
      const { text, userId, nickname, topic, serverName } = req.body;
      const { userMessage, aiMessage } = await channelToolService.deepDiveChat(
        req.params.channelId,
        text,
        userId,
        nickname,
        topic,
        serverName
      );
      res.json({ ok: true, userMessage, aiMessage });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  async generateMindMap(req: Request, res: Response) {
    try {
      const { topic, serverName } = req.body;
      const { mindMap, sourcesSummary } = await channelToolService.generateMindMap(
        req.params.channelId,
        topic,
        serverName
      );
      res.json({ ok: true, mindMap, sourcesSummary });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  async startSprint(req: Request, res: Response) {
    try {
      const { studyMin, breakMin, userId, nickname } = req.body;
      const sprint = await channelToolService.startSprint(
        req.params.channelId,
        studyMin,
        breakMin,
        userId,
        nickname
      );
      res.json({ ok: true, sprint });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  async updateSprintStatus(req: Request, res: Response) {
    try {
      const { userId, nickname, status } = req.body;
      const sprint = await channelToolService.updateSprintStatus(
        req.params.channelId,
        userId,
        nickname,
        status
      );
      res.json({ ok: true, sprint });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  async addNote(req: Request, res: Response) {
    try {
      const { title, content, category, userId, nickname } = req.body;
      const note = await channelToolService.addNote(
        req.params.channelId,
        title,
        content,
        category,
        userId,
        nickname
      );
      res.json({ ok: true, note });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  async editNote(req: Request, res: Response) {
    try {
      const { title, content, category } = req.body;
      const note = await channelToolService.editNote(
        req.params.channelId,
        req.params.noteId,
        { title, content, category }
      );
      res.json({ ok: true, note });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  async deleteNote(req: Request, res: Response) {
    try {
      await channelToolService.deleteNote(
        req.params.channelId,
        req.params.noteId
      );
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  async pinNote(req: Request, res: Response) {
    try {
      const note = await channelToolService.pinNote(
        req.params.channelId,
        req.params.noteId
      );
      res.json({ ok: true, note });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  lockTool(req: Request, res: Response) {
    try {
      const { channelId } = req.params;
      const { userId } = req.body;
      if (!userId) return res.status(400).json({ error: "Missing userId" });
      const result = channelToolService.lockTool(channelId, userId);
      res.json({ ok: true, ...result });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  unlockTool(req: Request, res: Response) {
    try {
      const { channelId } = req.params;
      const result = channelToolService.unlockTool(channelId);
      res.json({ ok: true, ...result });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  // ── Lesson listing (lightweight) ──────────────────────────────────────────
  getLessons(_req: Request, res: Response) {
    try {
      const lessons = listLessons();
      const summaries = lessons.map((l) => ({
        id: l.id,
        title: l.title,
        date: l.date,
        hasTranscript: !!(l.transcript && l.transcript.length > 0),
        hasSlideText: !!(l.slideText && l.slideText.length > 0),
        hasPlan: !!l.plan,
        courseCode: l.courseCode,
      }));
      res.json(summaries);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  // ── Link lesson to channel ────────────────────────────────────────────────
  async linkLesson(req: Request, res: Response) {
    try {
      const { channelId } = req.params;
      const { serverId, lessonId, lessonTitle } = req.body;
      if (!serverId || !lessonId || !lessonTitle) {
        return res.status(400).json({ error: "Missing serverId, lessonId, or lessonTitle" });
      }
      const updated = await channelRepo.update(serverId, channelId, { lessonId, lessonTitle });
      if (!updated) {
        return res.status(404).json({ error: "Channel not found" });
      }
      res.json({ ok: true, channel: updated });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  // ── Unlink lesson from channel ────────────────────────────────────────────
  async unlinkLesson(req: Request, res: Response) {
    try {
      const { channelId } = req.params;
      const { serverId } = req.body;
      if (!serverId) {
        return res.status(400).json({ error: "Missing serverId" });
      }
      const channel = await channelRepo.findById(serverId, channelId);
      if (!channel) {
        return res.status(404).json({ error: "Channel not found" });
      }
      // Remove lesson fields
      const updated = await channelRepo.update(serverId, channelId, {
        lessonId: undefined as any,
        lessonTitle: undefined as any,
      });
      res.json({ ok: true, channel: updated });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  // ── Get full lesson detail for panel ─────────────────────────────────────
  async getLessonDetail(req: Request, res: Response) {
    try {
      const { channelId } = req.params;
      const channel = await channelService.getByIdGlobal(channelId);
      if (!channel.lessonId) {
        return res.json({ linked: false });
      }
      const lesson = getLesson(channel.lessonId);
      if (!lesson) {
        return res.json({ linked: false });
      }

      const modules = lesson.plan?.modules?.map((m: any) => ({
        title: m.title,
        goal: m.goal,
      })) || null;

      const emphases = lesson.professorEmphases?.map((e: any) => ({
        statement: e.statement,
        why: e.why,
        evidence: e.evidence,
        confidence: e.confidence,
      })) || null;

      const cs = lesson.cheatSheet;
      const cheatSheet = cs ? {
        sections: cs.sections || [],
        formulas: cs.formulas || [],
        pitfalls: cs.pitfalls || [],
        quickQuiz: cs.quickQuiz || [],
      } : null;

      const rawLo = lesson.loModules?.modules;
      const loModules = rawLo?.length ? rawLo.map((m: any) => ({
        loId: m.loId,
        loTitle: m.loTitle,
        oneLineGist: m.oneLineGist,
        coreIdeas: m.coreIdeas || [],
        mustRemember: m.mustRemember || [],
        commonTraps: m.commonTraps || [],
        miniQuiz: m.miniQuiz || [],
        examples: m.examples || [],
      })) : null;

      const learningOutcomes = lesson.plan?.learning_outcomes?.length
        ? lesson.plan.learning_outcomes.map((lo: any) => ({
            code: lo.code,
            description: lo.description,
          }))
        : null;

      const keyConcepts = lesson.plan?.key_concepts || [];

      res.json({
        linked: true,
        lesson: {
          id: lesson.id,
          title: lesson.title,
          modules,
          emphases,
          cheatSheet,
          loModules,
          learningOutcomes,
          keyConcepts,
        },
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },

  // ── Get lesson context info for a channel ─────────────────────────────────
  async getLessonContext(req: Request, res: Response) {
    try {
      const { channelId } = req.params;
      const channel = await channelService.getByIdGlobal(channelId);
      if (!channel.lessonId) {
        return res.json({ linked: false });
      }
      const lesson = getLesson(channel.lessonId);
      if (!lesson) {
        return res.json({ linked: false });
      }
      const keyTopics: string[] = [];
      if (lesson.plan?.modules) {
        for (const mod of lesson.plan.modules) {
          if (mod.title) keyTopics.push(mod.title);
        }
      }

      // Enriched response with all available data indicators
      const loMods = lesson.loModules?.modules;
      const cs = lesson.cheatSheet;

      res.json({
        linked: true,
        lessonId: lesson.id,
        lessonTitle: lesson.title,
        hasTranscript: !!(lesson.transcript && lesson.transcript.length > 0),
        hasSlides: !!(lesson.slideText && lesson.slideText.length > 0),
        hasPlan: !!lesson.plan,
        hasCheatSheet: !!cs,
        hasLoModules: !!(loMods && loMods.length > 0),
        hasLearningOutcomes: !!(lesson.plan?.learning_outcomes && lesson.plan.learning_outcomes.length > 0),
        keyTopics: keyTopics.slice(0, 10),
        emphasesCount: lesson.professorEmphases?.length || 0,
        loModuleCount: loMods?.length || 0,
        quickQuizCount: cs?.quickQuiz?.length || 0,
        miniQuizCount: loMods?.reduce((sum: number, m: any) => sum + (m.miniQuiz?.length || 0), 0) || 0,
        mustRememberCount: loMods?.reduce((sum: number, m: any) => sum + (m.mustRemember?.length || 0), 0) || 0,
        formulaCount: cs?.formulas?.length || 0,
        pitfallCount: cs?.pitfalls?.length || 0,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },
};
