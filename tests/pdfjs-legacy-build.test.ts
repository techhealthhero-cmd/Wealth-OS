// @vitest-environment node
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

/**
 * Regression guard for iOS Safari < 26.2: the pdfjs "modern" build calls
 * Promise.try / Map#getOrInsertComputed directly. This runtime (like older
 * Safari) may lack them, so the real legacy build must open a PDF here.
 */
function syntheticPdf(text: string) {
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 100] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${`BT /F1 12 Tf 10 50 Td (${text}) Tj ET`.length} >>\nstream\nBT /F1 12 Tf 10 50 Td (${text}) Tj ET\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let body = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((object, index) => { offsets.push(body.length); body += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = body.length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}`;
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(body);
}

describe("pdfjs legacy build", () => {
  it("extracts text without relying on newest built-ins", async () => {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    pdfjs.GlobalWorkerOptions.workerSrc = createRequire(import.meta.url).resolve("pdfjs-dist/legacy/build/pdf.worker.min.mjs");
    const task = pdfjs.getDocument({ data: syntheticPdf("Synthetic statement"), verbosity: 0, useSystemFonts: true, disableFontFace: true, useWorkerFetch: false, enableXfa: false });
    try {
      const document = await task.promise;
      const page = await document.getPage(1);
      const content = await page.getTextContent();
      expect(content.items.map((item) => ("str" in item ? item.str : "")).join("")).toContain("Synthetic statement");
    } finally { await task.destroy(); }
  });
});
