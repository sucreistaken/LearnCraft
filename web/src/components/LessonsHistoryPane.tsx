// src/components/LessonsHistoryPane.tsx

import React, { useEffect, useState } from "react";
import { API_BASE } from "../config";
import { ModeId } from "../types";

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
  currentLessonId: string | null; // 👈 Yeni Prop
}

export default function LessonsHistoryPane({ setMode, setQuiz, onSelectLesson, currentLessonId }: Props) {
  const [lessons, setLessons] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  // Dersleri yükle
  useEffect(() => {
    setLoading(true);
    fetch(`${API_BASE}/api/lessons`)
      .then((r) => r.json())
      .then((j) => {
        if (Array.isArray(j)) {
          // En yeniden en eskiye sırala (varsa 'date' alanı, yoksa olduğu gibi)
          const sorted = j.sort((a, b) => (new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()));
          setLessons(sorted);
        }
      })
      .catch((e) => console.warn(e))
      .finally(() => setLoading(false));
  }, []);

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
              onClick={() => onSelectLesson(l.id)}
              className={`lesson-card ${isActive ? "lesson-card--active" : ""}`}
            >
              <div className="flex-between">
                <div className="font-bold text-lg truncate pr-2" title={l.title}>
                  {l.title}
                </div>
                {isActive && <div className="active-dot" title="Şu an açık"></div>}
              </div>
              
              <div className="text-xs op-60 mt-1 flex-between">
                <span>📅 {formatDate(l.date)}</span>
                {/* İleride buraya 'Vurgu Sayısı: 12' gibi istatistikler eklenebilir */}
              </div>

              {/* Alt Bilgi Çubuğu */}
              <div className="mt-3 flex gap-2">
                 {/* Örnek etiketler - backend verisine göre dinamik yapılabilir */}
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
    </div>
  );
}