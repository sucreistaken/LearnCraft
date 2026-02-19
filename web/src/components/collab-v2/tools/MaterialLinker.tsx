import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { channelToolApi } from "../../../services/channelToolApi";
import type { LessonSummary } from "../../../types";

interface Props {
  open: boolean;
  onClose: () => void;
  onLink: (lessonId: string, lessonTitle: string) => void;
  onUnlink: () => void;
  currentLessonId?: string;
}

export default function MaterialLinker({ open, onClose, onLink, onUnlink, currentLessonId }: Props) {
  const [lessons, setLessons] = useState<LessonSummary[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setLoading(true);
      channelToolApi.getLessons()
        .then(setLessons)
        .catch(() => setLessons([]))
        .finally(() => setLoading(false));
    }
  }, [open]);

  if (!open) return null;

  const filtered = lessons.filter((l) =>
    l.title.toLowerCase().includes(search.toLowerCase()) ||
    (l.courseCode && l.courseCode.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <AnimatePresence>
      <motion.div
        className="sh-material-linker__overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="sh-material-linker"
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="sh-material-linker__header">
            <h3>Materyal Bagla</h3>
            <button className="sh-material-linker__close" onClick={onClose}>✕</button>
          </div>

          {currentLessonId && (
            <div className="sh-material-linker__current">
              <span>Bagli ders: <strong>{lessons.find(l => l.id === currentLessonId)?.title || currentLessonId}</strong></span>
              <button
                className="sh-material-linker__unlink-btn"
                onClick={() => { onUnlink(); onClose(); }}
              >
                Kaldir
              </button>
            </div>
          )}

          <input
            className="sh-material-linker__search"
            type="text"
            placeholder="Ders ara..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />

          <div className="sh-material-linker__list">
            {loading && (
              <div className="sh-material-linker__loading">Dersler yukleniyor...</div>
            )}
            {!loading && filtered.length === 0 && (
              <div className="sh-material-linker__empty">
                {lessons.length === 0
                  ? "Henuz ders eklenmemis. Ana uygulamadan bir ders olusturun."
                  : "Aramayla eslesen ders bulunamadi."}
              </div>
            )}
            {filtered.map((lesson) => (
              <motion.div
                key={lesson.id}
                className={`sh-material-linker__item ${lesson.id === currentLessonId ? "sh-material-linker__item--active" : ""}`}
                onClick={() => { onLink(lesson.id, lesson.title); onClose(); }}
                whileHover={{ x: -2, y: -2 }}
                whileTap={{ x: 1, y: 1 }}
              >
                <div className="sh-material-linker__item-info">
                  <span className="sh-material-linker__item-title">{lesson.title}</span>
                  <span className="sh-material-linker__item-date">
                    {lesson.courseCode && <span className="sh-material-linker__course-code">{lesson.courseCode}</span>}
                    {new Date(lesson.date).toLocaleDateString("tr-TR")}
                  </span>
                </div>
                <div className="sh-material-linker__badges">
                  <span className={`sh-material-linker__badge ${lesson.hasTranscript ? "sh-material-linker__badge--has" : ""}`}>
                    Transkript
                  </span>
                  <span className={`sh-material-linker__badge ${lesson.hasSlideText ? "sh-material-linker__badge--has" : ""}`}>
                    Slayt
                  </span>
                  <span className={`sh-material-linker__badge ${lesson.hasPlan ? "sh-material-linker__badge--has" : ""}`}>
                    Plan
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
