import { Request, Response } from "express";
import { exportService } from "../services/exportService";

export const exportController = {
  exportQuiz(req: Request, res: Response) {
    const { channelId } = req.params;
    const data = exportService.exportQuiz(channelId);
    if (!data) return res.status(404).json({ error: "No quiz data" });
    res.json({ ok: true, data });
  },

  exportFlashcards(req: Request, res: Response) {
    const { channelId } = req.params;
    const data = exportService.exportFlashcards(channelId);
    if (!data) return res.status(404).json({ error: "No flashcard data" });
    res.json({ ok: true, data });
  },

  exportNotes(req: Request, res: Response) {
    const { channelId } = req.params;
    const data = exportService.exportNotes(channelId);
    if (!data) return res.status(404).json({ error: "No notes data" });
    res.json({ ok: true, data });
  },

  exportMindMap(req: Request, res: Response) {
    const { channelId } = req.params;
    const data = exportService.exportMindMap(channelId);
    if (!data) return res.status(404).json({ error: "No mind map data" });
    res.json({ ok: true, data });
  },

  exportAll(req: Request, res: Response) {
    const { channelId } = req.params;
    const data = exportService.exportAll(channelId);
    res.json({ ok: true, data });
  },
};
