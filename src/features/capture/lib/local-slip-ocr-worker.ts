import type { TesseractModule } from "./local-slip-ocr";

// Dedicated browser worker entry. No image/file-system cache or server imports.
const scope = globalThis as unknown as {
  location: { origin: string };
  onmessage: ((event: MessageEvent<Blob>) => void) | null;
  postMessage(value: unknown): void;
};
scope.onmessage = async (event) => {
  try {
    const modulePath = new URL("/ocr/tesseract.esm.min.js", scope.location.origin).href;
    const loaded = await import(/* webpackIgnore: true */ modulePath);
    const api = (loaded.default ?? loaded) as TesseractModule;
    const worker = await api.createWorker("tha+eng", 1, {
      workerPath: new URL("/ocr/worker.min.js", scope.location.origin).href,
      corePath: new URL("/ocr/core/", scope.location.origin).href,
      langPath: new URL("/ocr/lang/", scope.location.origin).href,
      workerBlobURL: false,
      cacheMethod: "none",
      errorHandler: () => scope.postMessage({ error: "OCR initialization/recognition failed" }),
    });
    // K PLUS slips are one column beside a QR. Auto segmentation (PSM 3) pulls the
    // QR into the date/amount lines; single-column keeps จำนวน and พ.ย. readable.
    const tunable = worker as typeof worker & { setParameters?(params: Record<string, string>): Promise<unknown> };
    try { await tunable.setParameters?.({ tessedit_pageseg_mode: "4" }); } catch { /* Keep reading if this build rejects the parameter. */ }
    try {
      const { data } = await worker.recognize(event.data);
      scope.postMessage({ data: { text: data.text, confidence: data.confidence } });
    } finally { await worker.terminate(); }
  } catch { scope.postMessage({ error: "Local OCR failed" }); }
};
