declare module "pdfjs-dist/legacy/build/pdf.worker.min.mjs" {
  /** pdf.js worker entry; importing it on the main thread also sets `globalThis.pdfjsWorker`. */
  export const WorkerMessageHandler: unknown;
}
