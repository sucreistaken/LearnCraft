import React from "react";
import Section from "./Section";

export default function ExamSprintPane() {
  return (
    <div className="grid-gap-12">
      <Section title="Sınav Sprinti">
        <div className="lc-chipset">
          <div className="lc-chip">Pomodoro 40–10</div>
          <div className="lc-chip">Son 48 saat tekrar</div>
        </div>
        <div className="lc-section op-65">Detaylar yakında.</div>
      </Section>
    </div>
  );
}