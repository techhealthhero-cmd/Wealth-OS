"use client";

import { groupTextItemsIntoLines } from "@/lib/import/pdf/lines";
import { PdfImportError, type PdfTextItem } from "@/lib/import/pdf/types";

export const PDF_MAX_PAGES = 100;
export const PDF_MAX_TEXT_ITEMS = 200_000;
export const PDF_MAX_TOTAL_CHARS = 5_000_000;
export const PDF_TIMEOUT_MS = 30_000;

export const PDF_IMPORT_MAX_BYTES = 5 * 1024 * 1024;

/** Browser only. Never pass a file URL, password, bytes or pdfjs error to a server/logger. */
export async function extractPdfLines(file: File, password: string, signal?: AbortSignal) {
  if (file.size > PDF_IMPORT_MAX_BYTES) throw new PdfImportError("pdf_too_large", "ไฟล์ PDF ต้องไม่เกิน 5 MB / PDF must be 5 MB or smaller.");
  let stopped = false;
  let destroyTask: (() => void) | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let abort: (() => void) | undefined;
  const interrupted = new Promise<never>((_, reject) => {
    const stop = (error: Error) => {
      stopped = true;
      destroyTask?.();
      reject(error);
    };
    timer = setTimeout(() => stop(new PdfImportError("pdf_timeout", "อ่าน PDF นานเกินไป กรุณาลองไฟล์ที่เล็กลงหรือส่งออกเป็น CSV / PDF reading timed out; try a smaller file or CSV.")), PDF_TIMEOUT_MS);
    abort = () => stop(new PdfImportError("invalid_pdf", "ยกเลิกการอ่าน PDF แล้ว / PDF reading cancelled."));
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) abort();
  });
  const work = async () => {
    const pdfjs = await import("pdfjs-dist");
    if (stopped) throw new Error("cancelled");
    pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (stopped) { bytes.fill(0); throw new Error("cancelled"); }
    // isEvalSupported is not supported by the installed pdfjs API.
    // No remote resources, PDF scripting, telemetry or verbosity output.
    const task = pdfjs.getDocument({ data: bytes, password, verbosity: 0, useSystemFonts: true, disableFontFace: true, useWorkerFetch: false, enableXfa: false });
    password = "";
    let destroyed = false;
    const destroy = () => {
      if (destroyed) return;
      destroyed = true;
      void task.destroy().catch(() => {});
    };
    destroyTask = destroy;
    try {
      if (signal?.aborted) throw new Error("cancelled");
      const document = await task.promise;
      if (stopped) throw new Error("cancelled");
      const limit = () => new PdfImportError("pdf_extraction_limit", "PDF มีหน้าหรือข้อความมากเกินไป กรุณาแบ่งไฟล์หรือส่งออกเป็น CSV / PDF extraction limit exceeded; split the file or use CSV.");
      if (document.numPages > PDF_MAX_PAGES) throw limit();
      const items: PdfTextItem[] = [];
      let itemCount = 0;
      let totalChars = 0;
      for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
        const page = await document.getPage(pageNumber);
        try {
          if (stopped) throw new Error("cancelled");
          const content = await page.getTextContent();
          if (stopped) throw new Error("cancelled");
          itemCount += content.items.length;
          if (itemCount > PDF_MAX_TEXT_ITEMS) throw limit();
          for (const item of content.items) {
            if (!("str" in item)) continue;
            totalChars += item.str.length;
            if (totalChars > PDF_MAX_TOTAL_CHARS) throw limit();
            items.push({ str: item.str, x: item.transform[4], y: item.transform[5], width: item.width, height: item.height, page: pageNumber });
          }
        } finally { page.cleanup(); }
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
      destroy();
      // pdfjs transfers the buffer to its worker; only wipe if it is still attached.
      if (bytes.byteLength) bytes.fill(0);
    }
  };
  try {
    return await Promise.race([interrupted, work()]);
  } catch (error) {
    if (error instanceof PdfImportError) throw error;
    throw new PdfImportError("invalid_pdf", "อ่าน PDF ไม่ได้ / Unable to read PDF; try CSV.");
  } finally {
    password = "";
    clearTimeout(timer);
    if (abort) signal?.removeEventListener("abort", abort);
  }
}
