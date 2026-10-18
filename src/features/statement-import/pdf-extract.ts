"use client";

import { groupTextItemsIntoLines } from "@/lib/import/pdf/lines";
import { PdfImportError, type PdfTextItem } from "@/lib/import/pdf/types";

export const PDF_IMPORT_MAX_BYTES = 5 * 1024 * 1024;

/** Browser only. Never pass a file URL, password, bytes or pdfjs error to a server/logger. */
export async function extractPdfLines(file: File, password: string, signal?: AbortSignal) {
  if (file.size > PDF_IMPORT_MAX_BYTES) throw new PdfImportError("pdf_too_large", "ไฟล์ PDF ต้องไม่เกิน 5 MB / PDF must be 5 MB or smaller.");
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  const bytes = new Uint8Array(await file.arrayBuffer());
  // No remote resources, PDF scripting, telemetry or verbosity output.
  const task = pdfjs.getDocument({ data: bytes, password, verbosity: 0, useSystemFonts: true, disableFontFace: true, useWorkerFetch: false });
  password = "";
  const abort = () => { void task.destroy(); };
  signal?.addEventListener("abort", abort, { once: true });
  try {
    if (signal?.aborted) throw new Error("cancelled");
    const document = await task.promise;
    const items: PdfTextItem[] = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      for (const item of content.items) {
        if (!("str" in item)) continue;
        items.push({ str: item.str, x: item.transform[4], y: item.transform[5], width: item.width, height: item.height, page: pageNumber });
      }
      page.cleanup();
    }
    const lines = groupTextItemsIntoLines(items);
    if (!lines.length) throw new PdfImportError("no_text", "PDF นี้ไม่มีข้อความที่อ่านได้ อาจเป็นภาพสแกน ลองส่งออกเป็น CSV / No readable text; try CSV.");
    return lines;
  } catch (error) {
    if (error instanceof PdfImportError) throw error;
    if (error instanceof Error && error.name === "PasswordException") {
      const code = "code" in error && error.code === pdfjs.PasswordResponses.INCORRECT_PASSWORD ? "password_incorrect" : "password_required";
      throw new PdfImportError(code, code === "password_incorrect" ? "รหัสผ่านไม่ถูกต้อง กรุณาลองอีกครั้ง / Incorrect password. Please try again." : "กรุณาใส่รหัสผ่าน PDF จากธนาคาร / Enter the PDF password from your bank.");
    }
    throw new PdfImportError("invalid_pdf", "อ่าน PDF ไม่ได้ กรุณาตรวจสอบไฟล์หรือลองส่งออกเป็น CSV / Unable to read PDF; try CSV.");
  } finally {
    signal?.removeEventListener("abort", abort);
    await task.destroy();
    // pdfjs transfers the buffer to its worker; only wipe if it is still attached.
    if (bytes.byteLength) bytes.fill(0);
  }
}
