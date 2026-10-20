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
    try {
      const { data } = await worker.recognize(event.data);
      scope.postMessage({ data: { text: data.text, confidence: data.confidence } });
    } finally { await worker.terminate(); }
  } catch { scope.postMessage({ error: "Local OCR failed" }); }
};
