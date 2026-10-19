"use client";

import { groupTextItemsIntoLines } from "@/lib/import/pdf/lines";
import { PdfImportError, type PdfTextItem, type PdfTextLine } from "@/lib/import/pdf/types";

export const PDF_MAX_PAGES = 100;
export const PDF_MAX_TEXT_ITEMS = 200_000;
export const PDF_MAX_TOTAL_CHARS = 5_000_000;
export const PDF_TIMEOUT_MS = 30_000;
export const PDF_WORKER_READY_MS = 10_000;

export const PDF_IMPORT_MAX_BYTES = 5 * 1024 * 1024;

/**
 * The legacy build ships core-js polyfills (main thread and worker), so it
 * also runs on browsers older than the modern pdfjs-dist v6 target.
 */
const loadPdfjs = () => import("pdfjs-dist/legacy/build/pdf.mjs");
type Pdfjs = Awaited<ReturnType<typeof loadPdfjs>>;
type Mode = "worker" | "main";

/** Error names only (never messages, which may contain document text). */
function errorName(error: unknown) {
  return error instanceof Error ? error.name || "Error" : typeof error;
}
function logPdfFailure(stage: string, error: unknown) {
  console.warn(`[pdf-import] ${stage}: ${errorName(error)}`);
}

const readerUnavailable = (detail: string) => new PdfImportError("pdf_reader_unavailable", "โหลดตัวอ่าน PDF ไม่สำเร็จ / Couldn't load the PDF reader.", detail);

/** Failures that say nothing about the file itself: the reader could not run. */
class ReaderStartError extends Error {
  constructor(public readonly stage: string, public readonly causeName: string) {
    super(`PDF reader ${stage} unavailable`);
    this.name = "ReaderStartError";
  }
}

/** File-level outcomes that must not trigger a fallback retry. */
function isFileVerdict(error: unknown) {
  return error instanceof PdfImportError
    || (error instanceof Error && ["PasswordException", "InvalidPDFException", "FormatError"].includes(error.name));
}

/**
 * Start pdf.js in a dedicated worker. The `new Worker(new URL(...))` form lets
 * the bundler emit the worker as a regular hashed JS chunk next to the app's
 * other chunks (same origin, same MIME type), instead of pdf.js fetching a raw
 * `.mjs` media asset itself. Resolves once the worker reports "ready".
 */
function startPdfWorker(): Promise<Worker> {
  return new Promise((resolve, reject) => {
    let worker: Worker;
    try {
      worker = new Worker(new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url), { type: "module" });
    } catch (error) {
      reject(new ReaderStartError("worker", errorName(error)));
      return;
    }
    const finish = (error?: ReaderStartError) => {
      clearTimeout(timer);
      worker.removeEventListener("message", onMessage);
      worker.removeEventListener("error", onError);
      if (error) {
        worker.terminate();
        reject(error);
      } else resolve(worker);
    };
    const onMessage = (event: MessageEvent) => {
      const data = event.data as { action?: unknown } | null;
      if (data && typeof data === "object" && data.action === "ready") finish();
    };
    const onError = (event: Event) => {
      event.preventDefault?.();
      finish(new ReaderStartError("worker", "WorkerError"));
    };
    const timer = setTimeout(() => finish(new ReaderStartError("worker", "WorkerTimeout")), PDF_WORKER_READY_MS);
    worker.addEventListener("message", onMessage);
    worker.addEventListener("error", onError);
  });
}

/**
 * Fallback: run the pdf.js worker code on the main thread. Importing the
 * worker module (bundled as an ordinary chunk) registers
 * `globalThis.pdfjsWorker`, which pdf.js uses instead of spawning a worker or
 * fetching `workerSrc`. Slower for big files, but statements are small.
 */
let mainThreadReady: Promise<void> | undefined;
function enableMainThreadReader() {
  mainThreadReady ??= import("pdfjs-dist/legacy/build/pdf.worker.min.mjs").then((module) => {
    const scope = globalThis as { pdfjsWorker?: { WorkerMessageHandler?: unknown } };
    if (!scope.pdfjsWorker?.WorkerMessageHandler) scope.pdfjsWorker = { WorkerMessageHandler: module.WorkerMessageHandler };
  }).catch((error: unknown) => {
    mainThreadReady = undefined;
    throw new ReaderStartError("main-load", errorName(error));
  });
  return mainThreadReady;
}

/** Browser only. Never pass a file URL, password, bytes or pdfjs error to a server/logger. */
export async function extractPdfLines(file: File, password: string, signal?: AbortSignal) {
  if (file.size > PDF_IMPORT_MAX_BYTES) throw new PdfImportError("pdf_too_large", "ไฟล์ PDF ต้องไม่เกิน 5 MB / PDF must be 5 MB or smaller.");
  let stopped = false;
  let cleanupAttempt: (() => void) | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let abort: (() => void) | undefined;
  const interrupted = new Promise<never>((_, reject) => {
    const stop = (error: Error) => {
      stopped = true;
      cleanupAttempt?.();
      reject(error);
    };
    timer = setTimeout(() => stop(new PdfImportError("pdf_timeout", "อ่าน PDF นานเกินไป กรุณาลองไฟล์ที่เล็กลงหรือส่งออกเป็น CSV / PDF reading timed out; try a smaller file or CSV.")), PDF_TIMEOUT_MS);
    abort = () => stop(new PdfImportError("invalid_pdf", "ยกเลิกการอ่าน PDF แล้ว / PDF reading cancelled."));
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) abort();
  });

  const attempt = async (pdfjs: Pdfjs, mode: Mode): Promise<PdfTextLine[]> => {
    let worker: Worker | undefined;
    let pdfWorker: InstanceType<Pdfjs["PDFWorker"]> | undefined;
    let task: ReturnType<Pdfjs["getDocument"]> | undefined;
    let bytes: Uint8Array | undefined;
    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      if (task) void task.destroy().catch(() => {});
      pdfWorker?.destroy();
      worker?.terminate();
      // pdfjs transfers the buffer to its worker; only wipe if it is still attached.
      if (bytes?.byteLength) bytes.fill(0);
    };
    cleanupAttempt = cleanup;
    try {
      if (mode === "worker") {
        worker = await startPdfWorker();
        if (stopped) throw new Error("cancelled");
        pdfWorker = pdfjs.PDFWorker.create({ port: worker });
      } else {
        await enableMainThreadReader();
      }
      if (stopped) throw new Error("cancelled");
      bytes = new Uint8Array(await file.arrayBuffer());
      if (stopped) throw new Error("cancelled");
      // No remote resources, PDF scripting, telemetry or verbosity output.
      task = pdfjs.getDocument({ data: bytes, password, verbosity: 0, useSystemFonts: true, disableFontFace: true, useWorkerFetch: false, enableXfa: false, ...(pdfWorker ? { worker: pdfWorker } : {}) });
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
    } finally {
      cleanup();
    }
  };

  const toFileError = (pdfjs: Pdfjs, error: unknown, stage: string) => {
    if (error instanceof PdfImportError) return error;
    if (error instanceof Error && error.name === "PasswordException") {
      const code = "code" in error && error.code === pdfjs.PasswordResponses.INCORRECT_PASSWORD ? "password_incorrect" : "password_required";
      return new PdfImportError(code, code === "password_incorrect" ? "รหัสผ่านไม่ถูกต้อง กรุณาลองอีกครั้ง / Incorrect password. Please try again." : "กรุณาใส่รหัสผ่าน PDF จากธนาคาร / Enter the PDF password from your bank.");
    }
    if (error instanceof ReaderStartError) return readerUnavailable(`${error.stage}:${error.causeName}`);
    if (error instanceof Error && ["TypeError", "ReferenceError", "SyntaxError"].includes(error.name)) return readerUnavailable(`${stage}:${error.name}`);
    return new PdfImportError("invalid_pdf", "อ่าน PDF ไม่ได้ กรุณาตรวจสอบไฟล์หรือลองส่งออกเป็น CSV / Unable to read PDF; try CSV.", `${stage}:${errorName(error)}`);
  };

  const work = async () => {
    let pdfjs: Pdfjs;
    try {
      pdfjs = await loadPdfjs();
    } catch (error) {
      logPdfFailure("load", error);
      throw readerUnavailable(`lib:${errorName(error)}`);
    }
    if (stopped) throw new Error("cancelled");
    const nameOf = (error: unknown) => error instanceof ReaderStartError ? error.causeName : errorName(error);
    let workerNote: string;
    try {
      return await attempt(pdfjs, "worker");
    } catch (error) {
      if (stopped) throw error;
      console.warn(`[pdf-import] worker: ${nameOf(error)}`);
      if (isFileVerdict(error)) throw toFileError(pdfjs, error, "worker");
      workerNote = `worker:${nameOf(error)}`;
    }
    try {
      return await attempt(pdfjs, "main");
    } catch (error) {
      if (stopped) throw error;
      console.warn(`[pdf-import] main: ${nameOf(error)}`);
      const failure = toFileError(pdfjs, error, "main");
      return Promise.reject(failure.detail ? new PdfImportError(failure.code, failure.message, `${workerNote},${failure.detail}`) : failure);
    }
  };
  try {
    return await Promise.race([interrupted, work()]);
  } catch (error) {
    if (error instanceof PdfImportError) throw error;
    throw new PdfImportError("invalid_pdf", "อ่าน PDF ไม่ได้ / Unable to read PDF; try CSV.", errorName(error));
  } finally {
    password = "";
    clearTimeout(timer);
    if (abort) signal?.removeEventListener("abort", abort);
  }
}
