import React, { useState, useRef } from "react";
import { CheatSheet } from "../types";
import { exportToPdf } from "../utils/pdfExport";
import { Card, CardHeader, CardBody } from "./ui/Card";
import { Button } from "./ui/Button";
import { Select } from "./ui/Select";
import { Badge } from "./ui/Badge";

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
      await exportToPdf(contentRef.current, cheatSheet.title || "CheatSheet");
    } catch (err) {
      console.error("PDF export error:", err);
    } finally {
      setPdfLoading(false);
    }
  };

  const labels = {
    tr: {
      title: "Cheat Sheet",
      subtitle: "Tek sayfalık, sınav odaklı ultra özet.",
      generate: "Cheat Sheet Oluştur",
      empty: "Henüz oluşturulmadı. 'Cheat Sheet Oluştur'a bas.",
      lastUpdate: "Son güncelleme:",
      formulas: "Formüller",
      pitfalls: "Dikkat Edilecekler",
      quickQuiz: "Hızlı Quiz",
      downloadPdf: "PDF İndir",
      language: "Dil:",
    },
    en: {
      title: "Cheat Sheet",
      subtitle: "One-page, exam-focused ultra summary.",
      generate: "Generate Cheat Sheet",
      empty: "Not created yet. Click \"Generate Cheat Sheet\".",
      lastUpdate: "Last update:",
      formulas: "Formulas",
      pitfalls: "Pitfalls",
      quickQuiz: "Quick Quiz",
      downloadPdf: "Download PDF",
      language: "Language:",
    }
  };

  const t = labels[language];

  return (
    <Card padding="md">
      <CardHeader>
        <div>
          <div className="u-font-extrabold u-text-lg">{t.title}</div>
          <div className="muted-block u-text-sm u-mt-1-5">
            {t.subtitle}
          </div>
        </div>

        <div className="u-flex u-items-center u-gap-2 u-flex-wrap">
          <div className="u-flex u-items-center u-gap-1-5">
            <span className="u-text-sm u-text-muted">{t.language}</span>
            <Select
              value={language}
              onChange={(e) => setLanguage(e.target.value as 'tr' | 'en')}
              selectSize="sm"
              fullWidth={false}
            >
              <option value="tr">Turkce</option>
              <option value="en">English</option>
            </Select>
          </div>

          <Button onClick={handleGenerate} loading={loading} size="md">
            {t.generate}
          </Button>

          {cheatSheet && (
            <Button
              variant="secondary"
              onClick={handleDownloadPdf}
              loading={pdfLoading}
              size="md"
            >
              {t.downloadPdf}
            </Button>
          )}
        </div>
      </CardHeader>

      <CardBody>
        {error && (
          <div className="u-text-danger u-text-sm u-mt-3">
            {error}
          </div>
        )}

        {!cheatSheet && !loading && (
          <div className="muted-block u-mt-3">
            {t.empty}
          </div>
        )}

        {cheatSheet && (
          <div ref={contentRef} className="u-mt-4 u-p-4 u-rounded-sm" style={{ backgroundColor: "var(--bg)" }}>
            <div className="u-font-extrabold u-text-md">{cheatSheet.title}</div>
            <div className="u-text-sm muted-block u-mt-1-5">
              {t.lastUpdate} {new Date(cheatSheet.updatedAt).toLocaleString()}
            </div>

            <div className="u-grid u-gap-3 u-mt-3">
              {cheatSheet.sections?.map((sec, i) => (
                <div key={i} className="muted-block">
                  <div className="u-font-bold u-mb-2">{sec.heading}</div>
                  <ul className="u-m-0" style={{ paddingLeft: 18 }}>
                    {(sec.bullets || []).map((b, k) => (
                      <li key={k} className="u-text-sm u-mb-1">
                        {b}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}

              {!!cheatSheet.formulas?.length && (
                <div className="muted-block">
                  <div className="u-font-bold u-mb-2">
                    <Badge variant="soft" size="sm">{t.formulas}</Badge>
                  </div>
                  <ul className="u-m-0" style={{ paddingLeft: 18 }}>
                    {cheatSheet.formulas.map((f, i) => (
                      <li key={i} className="u-text-sm">{f}</li>
                    ))}
                  </ul>
                </div>
              )}

              {!!cheatSheet.pitfalls?.length && (
                <div className="muted-block">
                  <div className="u-font-bold u-mb-2">
                    <Badge variant="warning" size="sm">{t.pitfalls}</Badge>
                  </div>
                  <ul className="u-m-0" style={{ paddingLeft: 18 }}>
                    {cheatSheet.pitfalls.map((p, i) => (
                      <li key={i} className="u-text-sm">{p}</li>
                    ))}
                  </ul>
                </div>
              )}

              {!!cheatSheet.quickQuiz?.length && (
                <div className="muted-block">
                  <div className="u-font-bold u-mb-2">
                    <Badge variant="primary" size="sm">{t.quickQuiz}</Badge>
                  </div>
                  <ul className="u-m-0" style={{ paddingLeft: 18 }}>
                    {cheatSheet.quickQuiz.map((qa, i) => (
                      <li key={i} className="u-text-sm u-mb-2">
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
      </CardBody>
    </Card>
  );
}
