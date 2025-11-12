import * as React from "react";
import Section from "./Section";
import { getLessons, getMemory, generateQuizFromLessonIds } from "../lib/api";

type LessonsHistoryPaneProps = {
  setMode: (m: any) => void;
  setQuiz: (q: string[]) => void;
  onSelectLesson?: (id: string) => void;
};

export default function LessonsHistoryPane({ setMode, setQuiz, onSelectLesson }: LessonsHistoryPaneProps) {
  const [lessons, setLessons] = React.useState<any[]>([]);
  const [filtered, setFiltered] = React.useState<any[]>([]);
  const [mem, setMem] = React.useState<any>(null);
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [q, setQ] = React.useState("");
  const [sort, setSort] = React.useState<"new"|"old"|"emphasis">("new");
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    (async () => {
      const [ls, mm] = await Promise.all([getLessons(), getMemory()]);
      setLessons(ls || []);
      setMem(mm || null);
      if ((ls || []).length) setActiveId(ls[0].id);
    })();
  }, []);

  React.useEffect(() => {
    let arr = [...lessons];

    if (q.trim()) {
      const w = q.trim().toLowerCase();
      arr = arr.filter((L) =>
        (L.title || "").toLowerCase().includes(w) ||
        (L.summary || "").toLowerCase().includes(w) ||
        (L.transcript || "").toLowerCase().includes(w)
      );
    }

    if (sort === "new") {
      arr.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    } else if (sort === "old") {
      arr.sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    } else {
      arr.sort((a,b) => (b.professorEmphases?.length||0) - (a.professorEmphases?.length||0));
    }

    setFiltered(arr);
  }, [lessons, q, sort]);

  const active = filtered.find(x => x.id === activeId) || filtered[0];

  const topEmphases = React.useMemo(() => {
    const map = new Map<string, number>();
    lessons.forEach(L => (L.professorEmphases||[]).forEach((e:any)=>{
      const key = (e.statement || "").trim();
      if (!key) return;
      map.set(key, (map.get(key)||0) + 1);
    }));
    return [...map.entries()].sort((a,b)=>b[1]-a[1]).slice(0,5);
  }, [lessons]);

  async function genQuizFromActive() {
    if (!active?.id) return;
    setLoading(true);
    try {
      const pack = await generateQuizFromLessonIds([active.id], 6);
      if (pack?.error) { alert(pack.error); return; }
      const qlist = (pack.items||[]).map((x:any)=>x.prompt);
      setQuiz(qlist);
      setMode("quiz");
    } catch (e:any) {
      alert(e?.message || "Quiz oluşturulamadı");
    } finally {
      setLoading(false);
    }
  }

  function downloadJSON(L:any) {
    const blob = new Blob([JSON.stringify(L, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${(L.title||"lesson").replace(/\s+/g,"_")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="grid-gap-12">
      <Section title="Derslerim (Geçmiş)">
        {/* Üst çubuk */}
        <div className="history-toolbar">
          <div className="history-toolbar__inputs">
            <div className="field-group">
              <span className="field-icon">🔎</span>
              <input
                className="input-plain"
                placeholder="Ara (başlık, özet, metin)…"
                value={q}
                onChange={(e)=>setQ(e.target.value)}
              />
            </div>
            <select className="select-plain" value={sort} onChange={(e)=>setSort(e.target.value as any)}>
              <option value="new">Yeni → Eski</option>
              <option value="old">Eski → Yeni</option>
              <option value="emphasis">Vurgu sayısına göre</option>
            </select>
          </div>

          <div className="history-toolbar__actions">
            {active && (
              <>
                <button className="btn btn-primary" onClick={genQuizFromActive} disabled={loading}>
                  {loading ? "Quiz oluşturuluyor…" : "Bu Dersten Quiz Oluştur"}
                </button>
                <button className="btn btn-ghost" onClick={()=>downloadJSON(active)}>JSON İndir</button>
              </>
            )}
          </div>
        </div>

        {/* Ana grid */}
        <div className="history-grid">
          {/* Sol: liste */}
          <aside className="history-list">
            {(filtered||[]).map((L:any)=>(
              <article
                key={L.id}
                onClick={()=>{
                  setActiveId(L.id);
                  onSelectLesson?.(L.id);
                }}
                className={`history-card ${activeId===L.id?"history-card--active":""}`}
                title={L.title || ""}
              >
                <div className="history-card__title">{L.title || "Başlık yok"}</div>
                <div className="history-card__meta">{L.date ? new Date(L.date).toLocaleString() : "tarih yok"}</div>
                <div className="history-card__chips">
                  <span className="chip">Vurgu: {L.professorEmphases?.length || 0}</span>
                  <span className="chip">Quiz: {L.quiz?.length || 0}</span>
                  {L.highlights?.length ? <span className="chip">Highlights: {L.highlights.length}</span> : null}
                </div>
              </article>
            ))}
            {!filtered?.length && <div className="muted">Kayıt yok.</div>}
          </aside>

          {/* Sağ: detay */}
          <main className="history-detail">
            {active ? (
              <>
                <section className="panel">
                  <div className="panel__title">{active.title || "Başlık yok"}</div>
                  <div className="panel__meta">{active.date ? new Date(active.date).toLocaleString() : "tarih yok"}</div>
                  {active.summary && <p className="panel__text">{active.summary}</p>}

                  {active.highlights?.length ? (
                    <>
                      <div className="panel__subtitle">Highlights</div>
                      <div className="chipset-wrap">
                        {active.highlights.map((h:string, i:number)=>(
                          <span key={i} className="chip chip--soft">{h}</span>
                        ))}
                      </div>
                    </>
                  ) : null}
                </section>

                <section className="panel">
                  <div className="panel__subtitle">Hoca Vurguları</div>
                  {(active.professorEmphases||[]).length ? (
                    <div className="vlist">
                      {active.professorEmphases.map((e:any, i:number)=>(
                        <div key={i} className="vlist__row">
                          <div className="vlist__main">
                            <div className="vlist__title">“{e.statement}”</div>
                            <div className="vlist__desc">{e.why}</div>
                            <div className="vlist__evi">Kanıt: {e.evidence || "—"}</div>
                          </div>
                          <div className="vlist__chips">
                            <span className="chip">{e.in_slides ? "Slaytta var" : "Slaytta yok"}</span>
                            <span className="chip">%{Math.round((e.confidence||0)*100)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : <div className="muted">Bu derste vurgu eklenmemiş.</div>}
                </section>

                <section className="panel">
                  <div className="panel__subtitle">Ham Metin Önizlemeleri</div>
                  <div className="preview-grid">
                    <pre className="preview-box">{(active.transcript||"").slice(0,1200) || "LEC boş"}</pre>
                    {active.slideText ? (
                      <pre className="preview-box">{String(active.slideText).slice(0,1200)}</pre>
                    ) : null}
                  </div>
                </section>

                <section className="panel panel--summary">
                  <div className="panel__subtitle">Genel Çıkarımlar</div>
                  <div className="chipset-wrap">
                    <span className="chip chip--outline">Toplam ders: {lessons.length}</span>
                    <span className="chip chip--outline">Toplam vurgu: {lessons.reduce((s,L)=>s+(L.professorEmphases?.length||0),0)}</span>
                  </div>

                  {mem?.recurringConcepts?.length ? (
                    <>
                      <div className="panel__caption">Tekrarlayan Kavramlar</div>
                      <div className="chipset-wrap">
                        {mem.recurringConcepts.slice(0,12).map((c:string,i:number)=>(
                          <span key={i} className="chip">{c}</span>
                        ))}
                      </div>
                    </>
                  ) : null}

                  {topEmphases.length ? (
                    <>
                      <div className="panel__caption">En Çok Vurgulanan İlk 5</div>
                      <ul className="ul clean">
                        {topEmphases.map(([s, n])=>(
                          <li key={s}>“{s}” — {n} derste geçti</li>
                        ))}
                      </ul>
                    </>
                  ) : null}
                </section>
              </>
            ) : (
              <div className="muted">Listeden bir ders seç.</div>
            )}
          </main>
        </div>
      </Section>
    </div>
  );
}
