import React from "react";
import Section from "./Section";

export default function DeepDivePane() {
  return (
    <div className="grid-gap-12">
      <Section title="Derinleşme (Boşluk Analizi)">
        <textarea className="lc-textarea textarea" placeholder="Eksiğim ne?" rows={4} />
        <input className="lc-textarea input" placeholder="Kaynak/Link/Sayfa" />
        <button className="btn">Okuma Listesi Üret</button>
      </Section>
    </div>
  );
}