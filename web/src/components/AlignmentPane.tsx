import React from "react";
import { Plan } from "../types";

/** Helper: Ortalama hesaplama */
function average(ns: number[]) {
  if (!ns.length) return NaN;
  const s = ns.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0);
  const c = ns.filter(n => Number.isFinite(n)).length;
  return c ? s / c : NaN;
}

export default function AlignmentPane({ plan }: { plan: Plan }) {
  const a = plan.alignment;
  const avg = a?.average_duration_min ?? average(a?.items?.map(i => i.duration_min) || []);

  return (
    <div className="grid-gap-12">
      <section className="lc-section grid-gap-10">
        <div className="fw-800 fs-18">Eşleştirme Özeti</div>
        {a?.summary_chatty ? (
          <p className="m-0">{a.summary_chatty}</p>
        ) : (
          <p className="m-0 op-70">
            Özet metni bulunamadı. Yine de aşağıdaki tablo eşleşmeleri ve süreleri gösterir.
          </p>
        )}
        <div className="lc-chipset">
          <div className="lc-chip">Ortalama süre: ~{Number.isFinite(avg) ? `${avg.toFixed(1)} dk` : "—"}</div>
        </div>
      </section>

      <section className="lc-section">
        <table className="aligned-table">
          <thead>
            <tr>
              <th>Konu / Kavramlar</th>
              <th>Vurgu</th>
              <th>Kaynaklar</th>
              <th>Süre (dk)</th>
            </tr>
          </thead>
          <tbody>
            {(a?.items || []).map((it, i) => (
              <tr key={i}>
                <td>
                  <div className="fw-700">{it.topic}</div>
                  {!!it.concepts?.length && (
                    <div className="muted"> {it.concepts.join(", ")} </div>
                  )}
                </td>
                <td>
                  <div className="lc-chipset m-0">
                    <span className="pill">{it.in_both ? "Konuşma+Slayt" : "Tek kaynak"}</span>
                    <span className="pill">Emphasis: {it.emphasis_level}</span>
                    <span className="pill">Güven: %{Math.round((it.confidence ?? 0) * 100)}</span>
                  </div>
                </td>
                <td>
                  {it.lecture_quotes?.slice(0, 2).map((q, qi) => (<div key={qi} className="muted">“{q}”</div>))}
                  {it.slide_refs?.slice(0, 2).map((s, si) => (<div key={si} className="muted">• {s}</div>))}
                </td>
                <td className="fw-700">{Number.isFinite(it.duration_min) ? it.duration_min.toFixed(1) : "—"}</td>
              </tr>
            ))}
            {!a?.items?.length && (
              <tr><td colSpan={4} className="muted">Eşleşme bulunamadı.</td></tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}