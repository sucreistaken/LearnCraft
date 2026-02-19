import { channelToolRepo } from "../repositories/channelToolRepo";

export const exportService = {
  exportQuiz(channelId: string) {
    const data = channelToolRepo.load(channelId);
    if (!data.quiz) return null;

    const questions = data.quiz.questions.map(q => ({
      question: q.question,
      options: q.options,
      correctAnswer: q.options[q.correctIndex],
      explanation: q.explanation,
      type: q.type || 'mc',
      difficulty: q.difficulty || 'medium',
    }));

    const scores = Object.entries(data.quiz.scores).map(([userId, s]) => ({
      nickname: s.nickname,
      correct: s.correct,
      total: s.total,
      percentage: s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0,
    }));

    return { questions, scores, generatedAt: data.quiz.generatedAt };
  },

  exportFlashcards(channelId: string) {
    const data = channelToolRepo.load(channelId);
    if (!data.flashcards) return null;

    return data.flashcards.cards.map(c => ({
      front: c.front,
      back: c.back,
      hint: c.hint,
      topic: c.topic,
      createdBy: c.createdByNickname,
      source: c.source,
    }));
  },

  exportNotes(channelId: string) {
    const data = channelToolRepo.load(channelId);
    if (!data.notes) return null;

    return data.notes.items.map(n => ({
      title: n.title,
      content: n.content,
      category: n.category,
      author: n.authorNickname,
      pinned: n.pinned,
      createdAt: n.createdAt,
    }));
  },

  exportMindMap(channelId: string) {
    const data = channelToolRepo.load(channelId);
    if (!data.mindMap) return null;

    return {
      mermaidCode: data.mindMap.mermaidCode,
      topic: data.mindMap.topic,
      generatedAt: data.mindMap.generatedAt,
    };
  },

  exportAll(channelId: string) {
    return {
      quiz: this.exportQuiz(channelId),
      flashcards: this.exportFlashcards(channelId),
      notes: this.exportNotes(channelId),
      mindMap: this.exportMindMap(channelId),
      exportedAt: new Date().toISOString(),
    };
  },
};
