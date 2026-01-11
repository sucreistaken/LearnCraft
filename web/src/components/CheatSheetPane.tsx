import React, { useState, useRef } from "react";
import { CheatSheet } from "../types";

// html2pdf.js'yi dinamik olarak yükle
const loadHtml2Pdf = async () => {
  const module = await import("html2pdf.js");
  return module.default;
};

export default function CheatSheetPane(props: {
  cheatSheet: CheatSheet | null;
  loading: boolean;
  error: string | null;
  onGenerate: (language: 'tr' | 'en') => void;
}) {
  const { cheatSheet, loading, error, onGenerate } = props;
  const [language, setLanguage] = useState<'tr' | 'en'>('tr');
  const [pdfLoading, setPdfLoading] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const handleGenerate = () => {
    onGenerate(language);
  };

  const handleDownloadPdf = async () => {
    if (!contentRef.current || !cheatSheet) return;

    setPdfLoading(true);
    try {
      const html2pdf = await loadHtml2Pdf();
      const element = contentRef.current;

      const opt = {
        margin: [10, 10, 10, 10] as [number, number, number, number],
        filename: `${cheatSheet.title || 'CheatSheet'}.pdf`,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const }
      };

      await html2pdf().set(opt).from(element).save();
    } catch (err) {
      console.error("PDF oluşturma hatası:", err);
    } finally {
      setPdfLoading(false);
    }
  };

  const labels = {
    tr: {
      title: "Cheat Sheet",
      subtitle: "Tek sayfalık, sınav odaklı ultra özet.",
      generate: "Cheat Sheet Oluştur",
      generating: "Üretiliyor...",
      empty: "Henüz oluşturulmadı. 'Cheat Sheet Oluştur'a bas.",
      lastUpdate: "Son güncelleme:",
      formulas: "Formüller",
      pitfalls: "Dikkat Edilecekler",
      quickQuiz: "Hızlı Quiz",
      downloadPdf: "PDF İndir",
      downloading: "İndiriliyor...",
      language: "Dil:",
    },
    en: {
      title: "Cheat Sheet",
      subtitle: "One-page, exam-focused ultra summary.",
      generate: "Generate Cheat Sheet",
      generating: "Generating...",
      empty: "Not created yet. Click \"Generate Cheat Sheet\".",
      lastUpdate: "Last update:",
      formulas: "Formulas",
      pitfalls: "Pitfalls",
      quickQuiz: "Quick Quiz",
      downloadPdf: "Download PDF",
      downloading: "Downloading...",
      language: "Language:",
    }
  };

  const t = labels[language];

  return (
    <div className="card" style={{ padding: 16 }}>
      <div className="flex-between" style={{ gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 18 }}>{t.title}</div>
          <div className="muted-block small" style={{ marginTop: 6 }}>
            {t.subtitle}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {/* Dil Seçimi */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span className="small muted">{t.language}</span>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as 'tr' | 'en')}
              className="lc-select"
              style={{
                padding: "6px 10px",
                fontSize: 13,
                minWidth: 90,
                borderRadius: 6
              }}
            >
              <option value="tr">🇹🇷 Türkçe</option>
              <option value="en">🇬🇧 English</option>
            </select>
          </div>

          <button className="btn" onClick={handleGenerate} disabled={loading}>
            {loading ? t.generating : t.generate}
          </button>

          {cheatSheet && (
            <button
              className="btn btn-secondary"
              onClick={handleDownloadPdf}
              disabled={pdfLoading}
              style={{ display: "flex", alignItems: "center", gap: 6 }}
            >
              📄 {pdfLoading ? t.downloading : t.downloadPdf}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="error mt-2 text-red-500 text-sm" style={{ marginTop: 12 }}>
          {error}
        </div>
      )}

      {!cheatSheet && !loading && (
        <div className="muted-block" style={{ marginTop: 14 }}>
          {t.empty}
        </div>
      )}

      {cheatSheet && (
        <div ref={contentRef} style={{ marginTop: 16, backgroundColor: "var(--bg)", padding: 16, borderRadius: 8 }}>
          <div style={{ fontWeight: 800, fontSize: 16 }}>{cheatSheet.title}</div>
          <div className="small muted-block" style={{ marginTop: 6 }}>
            {t.lastUpdate} {new Date(cheatSheet.updatedAt).toLocaleString()}
          </div>

          <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
            {cheatSheet.sections?.map((sec, i) => (
              <div key={i} className="muted-block">
                <div style={{ fontWeight: 700, marginBottom: 6 }}>{sec.heading}</div>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {(sec.bullets || []).map((b, k) => (
                    <li key={k} className="small" style={{ marginBottom: 4 }}>
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
            ))}

            {!!cheatSheet.formulas?.length && (
              <div className="muted-block">
                <div style={{ fontWeight: 700, marginBottom: 6 }}>{t.formulas}</div>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {cheatSheet.formulas.map((f, i) => (
                    <li key={i} className="small">{f}</li>
                  ))}
                </ul>
              </div>
            )}

            {!!cheatSheet.pitfalls?.length && (
              <div className="muted-block">
                <div style={{ fontWeight: 700, marginBottom: 6 }}>{t.pitfalls}</div>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {cheatSheet.pitfalls.map((p, i) => (
                    <li key={i} className="small">{p}</li>
                  ))}
                </ul>
              </div>
            )}

            {!!cheatSheet.quickQuiz?.length && (
              <div className="muted-block">
                <div style={{ fontWeight: 700, marginBottom: 6 }}>{t.quickQuiz}</div>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {cheatSheet.quickQuiz.map((qa, i) => (
                    <li key={i} className="small" style={{ marginBottom: 6 }}>
                      <div><b>Q:</b> {qa.q}</div>
                      <div><b>A:</b> {qa.a}</div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
