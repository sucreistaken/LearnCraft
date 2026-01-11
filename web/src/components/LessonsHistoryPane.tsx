// src/components/LessonsHistoryPane.tsx

import React, { useEffect, useState } from "react";
import { API_BASE } from "../config";
import { ModeId } from "../types";
import { lessonsApi } from "../services/api";

// Tarih formatlayıcı (Örn: "2 Ara 2025, 14:30")
const formatDate = (d?: string) => {
  if (!d) return "";
  return new Date(d).toLocaleDateString("tr-TR", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
  });
};

interface Props {
  setMode: (m: ModeId) => void;
  setQuiz: (q: string[]) => void;
  onSelectLesson: (id: string) => void;
  currentLessonId: string | null;
  onLessonDeleted?: () => void;
}

export default function LessonsHistoryPane({ setMode, setQuiz, onSelectLesson, currentLessonId, onLessonDeleted }: Props) {
  const [lessons, setLessons] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Dersleri yükle
  const loadLessons = () => {
    setLoading(true);
    fetch(`${API_BASE}/api/lessons`)
      .then((r) => r.json())
      .then((j) => {
        if (Array.isArray(j)) {
          const sorted = j.sort((a, b) => (new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()));
          setLessons(sorted);
        }
      })
      .catch((e) => console.warn(e))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadLessons();
  }, []);

  // Ders silme
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const result = await lessonsApi.delete(deleteTarget.id);
    setDeleting(false);
    if (result.ok) {
      setLessons(prev => prev.filter(l => l.id !== deleteTarget.id));
      setDeleteTarget(null);
      if (deleteTarget.id === currentLessonId) {
        onLessonDeleted?.();
      }
    } else {
      alert(result.error || "Silme işlemi başarısız oldu.");
    }
  };

  // Arama filtresi
  const filtered = lessons.filter(l =>
    l.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="history-pane">
      {/* Header */}
      <div className="flex-between mb-4 items-center">
        <h2 className="text-xl font-bold m-0">Kayıtlı Derslerim</h2>
        <span className="badge badge-gray">{lessons.length} Ders</span>
      </div>

      {/* Search Bar */}
      <div className="mb-4 relative">
        <input
          className="lc-textarea input w-full pl-8"
          placeholder="Ders ara..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <span className="absolute left-2 top-2 opacity-50">🔍</span>
      </div>

      {/* Loading State */}
      {loading && <div className="p-4 text-center op-60">Dersler yükleniyor...</div>}

      {/* Liste */}
      <div className="grid-gap-12">
        {filtered.length === 0 && !loading && (
          <div className="p-4 border rounded text-center op-60 bg-gray-50">
            {search ? "Ders bulunamadı." : "Henüz hiç dersin yok."}
          </div>
        )}

        {filtered.map((l) => {
          const isActive = l.id === currentLessonId;

          return (
            <div
              key={l.id}
              className={`lesson-card ${isActive ? "lesson-card--active" : ""}`}
            >
              <div className="flex-between">
                <div
                  className="font-bold text-lg truncate pr-2 cursor-pointer flex-1"
                  title={l.title}
                  onClick={() => onSelectLesson(l.id)}
                >
                  {l.title}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {isActive && <div className="active-dot" title="Şu an açık"></div>}
                  <button
                    className="btn-icon-danger"
                    title="Dersi Sil"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteTarget({ id: l.id, title: l.title });
                    }}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      opacity: 0.6,
                      transition: 'opacity 0.2s',
                      fontSize: 16,
                      padding: 4,
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                    onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.6')}
                  >
                    🗑️
                  </button>
                </div>
              </div>

              <div className="text-xs op-60 mt-1 flex-between" onClick={() => onSelectLesson(l.id)}>
                <span>📅 {formatDate(l.date)}</span>
              </div>

              {/* Alt Bilgi Çubuğu */}
              <div className="mt-3 flex gap-2" onClick={() => onSelectLesson(l.id)}>
                {l.highlights?.length > 0 && (
                  <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                    ✨ {l.highlights.length} Kavram
                  </span>
                )}
                <span className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded ml-auto">
                  {isActive ? "Açık" : "İncele →"}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
          onClick={() => setDeleteTarget(null)}
        >
          <div
            style={{
              background: 'var(--card-bg, white)',
              padding: 24,
              borderRadius: 16,
              maxWidth: 400,
              width: '90%',
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 40, textAlign: 'center', marginBottom: 16 }}>⚠️</div>
            <h3 style={{ textAlign: 'center', marginBottom: 8, fontWeight: 700 }}>Dersi Sil</h3>
            <p style={{ textAlign: 'center', color: 'var(--muted)', marginBottom: 24 }}>
              "<strong>{deleteTarget.title}</strong>" dersini silmek istediğinize emin misiniz? Bu işlem geri alınamaz.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button
                className="btn btn-ghost"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
              >
                İptal
              </button>
              <button
                className="btn"
                style={{ background: '#ef4444', color: 'white' }}
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? "Siliniyor..." : "Evet, Sil"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
