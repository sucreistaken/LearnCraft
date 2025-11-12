import React from "react";
import { getMemory } from "../lib/api";

export default function MemoryPanel(){
  const [mem, setMem] = React.useState<any>(null);
  React.useEffect(()=>{ getMemory().then(setMem); },[]);
  if(!mem) return <div className="op-65">Hafıza yükleniyor…</div>;
  return (
    <section className="lc-section grid-gap-10">
      <div className="fw-800 fs-18">AI Hafıza & Geçmiş Analiz</div>
      <div className="lc-chipset">
        {(mem.recurringConcepts||[]).map((c:string,i:number)=>(
          <span key={i} className="pill">{c}</span>
        ))}
      </div>
      <div className="grid-gap-6">
        {(mem.recentEmphases||[]).map((e:any,i:number)=>(
          <div key={i} className="row-3col">
            <div className="fw-700">“{e.statement}”</div>
            <div className="op-70">{e.why}</div>
            <div className="pill">conf %{Math.round((e.confidence||0)*100)}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
