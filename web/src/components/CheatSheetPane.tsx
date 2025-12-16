import React from "react";
import { CheatSheet } from "../types";

export default function CheatSheetPane(props: {
  cheatSheet: CheatSheet | null;
  loading: boolean;
  error: string | null;
  onGenerate: () => void;
}) {
  const { cheatSheet, loading, error, onGenerate } = props;

  return (
    <div className="card" style={{ padding: 16 }}>
      <div className="flex-between" style={{ gap: 12, alignItems: "center" }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 18 }}>Cheat Sheet</div>
          <div className="muted-block small" style={{ marginTop: 6 }}>
            Tek sayfalık, sınav odaklı ultra özet.
          </div>
        </div>

        <button className="btn" onClick={onGenerate} disabled={loading}>
          {loading ? "Üretiliyor..." : "Cheat Sheet Oluştur"}
        </button>
      </div>

      {error && (
        <div className="error mt-2 text-red-500 text-sm" style={{ marginTop: 12 }}>
          {error}
        </div>
      )}

      {!cheatSheet && !loading && (
        <div className="muted-block" style={{ marginTop: 14 }}>
          Henüz oluşturulmadı. “Cheat Sheet Oluştur”a bas.
        </div>
      )}

      {cheatSheet && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontWeight: 800, fontSize: 16 }}>{cheatSheet.title}</div>
          <div className="small muted-block" style={{ marginTop: 6 }}>
            Son güncelleme: {new Date(cheatSheet.updatedAt).toLocaleString()}
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
                <div style={{ fontWeight: 700, marginBottom: 6 }}>Formulas</div>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {cheatSheet.formulas.map((f, i) => (
                    <li key={i} className="small">{f}</li>
                  ))}
                </ul>
              </div>
            )}

            {!!cheatSheet.pitfalls?.length && (
              <div className="muted-block">
                <div style={{ fontWeight: 700, marginBottom: 6 }}>Pitfalls</div>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {cheatSheet.pitfalls.map((p, i) => (
                    <li key={i} className="small">{p}</li>
                  ))}
                </ul>
              </div>
            )}

            {!!cheatSheet.quickQuiz?.length && (
              <div className="muted-block">
                <div style={{ fontWeight: 700, marginBottom: 6 }}>Quick Quiz</div>
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
