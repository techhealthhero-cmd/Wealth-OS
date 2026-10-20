"use client";

export interface LocalWorker {
  recognize(image: Blob): Promise<{ data: SlipOCRResult }>;
  terminate(): Promise<unknown>;
}
export interface TesseractModule { createWorker(languages: string, mode: number, options: Record<string, unknown>): Promise<LocalWorker> }

export interface SlipOCRResult { text: string; /** Tesseract confidence, 0–100. */ confidence: number }
export interface SlipOCR { recognizeSlipText(image: Blob): Promise<SlipOCRResult> }
/** Injectable loader keeps lifecycle tests independent of OCR assets. */
export function createLocalSlipOCR(loadModule: () => Promise<TesseractModule>): SlipOCR {
  // Shared adapter serializes calls even across concurrent batches.
  let pending: Promise<unknown> = Promise.resolve();
  return {
    recognizeSlipText(image) {
      if (typeof window === "undefined") return Promise.reject(new Error("Slip OCR requires a browser"));
      const task = pending.then(async () => {
        const { createWorker } = await loadModule();
        const worker = await createWorker("tha+eng", 1, {
          workerPath: new URL("/ocr/worker.min.js", window.location.origin).href,
          corePath: new URL("/ocr/core/", window.location.origin).href,
          langPath: new URL("/ocr/lang/", window.location.origin).href,
          workerBlobURL: false,
          cacheMethod: "none",
          // Avoid the library throwing an uncaught error as well as rejecting the job.
          errorHandler: () => undefined,
        });
        try {
          const { data } = await worker.recognize(image);
          return { text: data.text, confidence: data.confidence };
        } finally { await worker.terminate(); }
      });
      pending = task.catch(() => undefined);
      return task;
    },
  };
}
// Isolate Tesseract in a parent worker so even failed/hung initialization can be
// cleaned up: terminating a worker also terminates its nested OCR worker.
const localOCR = createLocalSlipOCR(async () => ({
  async createWorker() {
    const bridge = new Worker(new URL("./local-slip-ocr-worker.ts", import.meta.url));
    let timer: ReturnType<typeof setTimeout> | undefined;
    return {
      recognize(image) {
        return new Promise((resolve, reject) => {
          timer = setTimeout(() => reject(new Error("Slip OCR timed out")), 120_000);
          bridge.onerror = () => reject(new Error("Local OCR worker failed"));
          bridge.onmessage = (event: MessageEvent<{ data?: SlipOCRResult; error?: string }>) => {
            if (event.data.error || !event.data.data) reject(new Error("Local OCR failed"));
            else resolve({ data: event.data.data });
          };
          bridge.postMessage(image);
        });
      },
      async terminate() { clearTimeout(timer); bridge.terminate(); },
    };
  },
}));
export function recognizeSlipText(image: Blob): Promise<SlipOCRResult> {
  return localOCR.recognizeSlipText(image);
}
