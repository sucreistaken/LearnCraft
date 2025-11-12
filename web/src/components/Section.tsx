// Section.tsx
import React from "react";
export default function Section({ title, children }: {title:string; children:React.ReactNode}) {
  return (
    <section className="lc-section grid-gap-12">
      <div className="fw-800 fs-18">{title}</div>
      {children}
    </section>
  );
}
