// utils/pdfExport.ts

export async function exportToPdf(
  element: HTMLElement,
  filename: string,
  options?: {
    orientation?: "portrait" | "landscape";
    margin?: number;
  }
): Promise<void> {
  const html2pdf = (await import("html2pdf.js")).default;
  const margin = options?.margin ?? 10;

  const opt = {
    margin: [margin, margin, margin, margin] as [number, number, number, number],
    filename: filename.endsWith(".pdf") ? filename : `${filename}.pdf`,
    image: { type: "jpeg" as const, quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: {
      unit: "mm" as const,
      format: "a4" as const,
      orientation: (options?.orientation || "portrait") as "portrait" | "landscape",
    },
  };

  await html2pdf().set(opt).from(element).save();
}
