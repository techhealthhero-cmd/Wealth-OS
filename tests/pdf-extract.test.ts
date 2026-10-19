import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({ getDocument: vi.fn(), worker: { workerSrc: "" }, createWorker: vi.fn((params: { port: unknown }) => ({ port: params.port, destroy: vi.fn() })) }));
vi.mock("pdfjs-dist/legacy/build/pdf.mjs", () => ({ getDocument: mock.getDocument, GlobalWorkerOptions: mock.worker, PasswordResponses: { INCORRECT_PASSWORD: 2 }, PDFWorker: { create: mock.createWorker } }));
vi.mock("pdfjs-dist/legacy/build/pdf.worker.min.mjs", () => ({ WorkerMessageHandler: { setup: () => {} } }));
import { extractPdfLines, PDF_IMPORT_MAX_BYTES, PDF_WORKER_READY_MS } from "../src/features/statement-import/pdf-extract";

beforeEach(() => { vi.clearAllMocks(); });

describe("browser PDF boundary", () => {
  it("passes bytes only to the local worker and destroys it after extraction", async () => {
    const cleanup = vi.fn();
    const destroy = vi.fn().mockResolvedValue(undefined);
    const items = [{ str: "Synthetic", transform: [1, 0, 0, 1, 10, 30], width: 50, height: 10 }];
    mock.getDocument.mockReturnValue({ promise: Promise.resolve({ numPages: 1, getPage: async () => ({ getTextContent: async () => ({ items }), cleanup }) }), destroy });
    const result = await extractPdfLines(new File(["synthetic PDF bytes"], "synthetic.pdf"), "synthetic-password");
    expect(result[0].text).toBe("Synthetic");
    expect(mock.getDocument).toHaveBeenCalledWith(expect.objectContaining({ data: expect.any(Uint8Array), password: "synthetic-password", verbosity: 0, useWorkerFetch: false, enableXfa: false }));
    expect(mock.getDocument.mock.calls[0][0]).not.toHaveProperty("url");
    // No worker in this environment: the bundled main-thread reader is used, never a fetched workerSrc.
    expect(mock.worker.workerSrc).toBe("");
    expect((globalThis as { pdfjsWorker?: unknown }).pdfjsWorker).toBeTruthy();
    expect(cleanup).toHaveBeenCalledOnce();
    expect(destroy).toHaveBeenCalledOnce();
    expect([...mock.getDocument.mock.calls[0][0].data]).toEqual(Array(19).fill(0));
  });
  it.each([[1, "password_required"], [2, "password_incorrect"]])("maps password reason %s to safe copy and destroys the task", async (code, expected) => {
    const destroy = vi.fn().mockResolvedValue(undefined);
    mock.getDocument.mockReturnValue({ promise: Promise.reject(Object.assign(new Error("sensitive error detail"), { name: "PasswordException", code })), destroy });
    await expect(extractPdfLines(new File(["test"], "test.pdf"), "secret")).rejects.toMatchObject({ code: expected });
    expect(destroy).toHaveBeenCalledOnce();
  });
  it("rejects oversized input before loading PDF data", async () => {
    const file = new File([new Uint8Array(PDF_IMPORT_MAX_BYTES + 1)], "large.pdf");
    await expect(extractPdfLines(file, "")).rejects.toMatchObject({ code: "pdf_too_large" });
    expect(mock.getDocument).not.toHaveBeenCalled();
  });
  it("does not expose PDF errors or their contents", async () => {
    const destroy = vi.fn().mockResolvedValue(undefined);
    mock.getDocument.mockReturnValue({ promise: Promise.reject(new Error("sensitive PDF content")), destroy });
    await expect(extractPdfLines(new File(["test"], "test.pdf"), "secret")).rejects.toMatchObject({ code: "invalid_pdf", message: expect.not.stringContaining("sensitive") });
    expect(destroy).toHaveBeenCalledOnce();
  });
  it("explains scanned/empty PDFs and cleans up", async () => {
    const destroy = vi.fn().mockResolvedValue(undefined);
    mock.getDocument.mockReturnValue({ promise: Promise.resolve({ numPages: 0 }), destroy });
    await expect(extractPdfLines(new File(["test"], "test.pdf"), "")).rejects.toMatchObject({ code: "no_text" });
    expect(destroy).toHaveBeenCalledOnce();
  });
});

it.each(["loading", "page", "text"])("times out stalled %s and destroys the worker", async (stage) => {
  vi.useFakeTimers();
  try {
    const never = new Promise<never>(() => {});
    const destroy = vi.fn().mockResolvedValue(undefined);
    mock.getDocument.mockReturnValue({ destroy, promise: stage === "loading" ? never : Promise.resolve({ numPages: 1, getPage: () => stage === "page" ? never : Promise.resolve({ getTextContent: () => never }) }) });
    const result = extractPdfLines(new File(["test"], "test.pdf"), "");
    const assertion = expect(result).rejects.toMatchObject({ code: "pdf_timeout" });
    await vi.advanceTimersByTimeAsync(30_000);
    await assertion;
    expect(destroy).toHaveBeenCalledOnce();
  } finally { vi.useRealTimers(); }
});

it.each(["pages", "items", "chars"])("rejects excessive %s and destroys the worker", async (budget) => {
  const destroy = vi.fn().mockResolvedValue(undefined);
  const cleanup = vi.fn();
  const item = { str: budget === "chars" ? "x".repeat(5_000_001) : "x", transform: [1, 0, 0, 1, 0, 0], width: 1, height: 1 };
  mock.getDocument.mockReturnValue({ destroy, promise: Promise.resolve({ numPages: budget === "pages" ? 101 : 1, getPage: async () => ({ getTextContent: async () => ({ items: budget === "items" ? Array(200_001).fill(item) : [item] }), cleanup }) }) });
  await expect(extractPdfLines(new File(["test"], "test.pdf"), "")).rejects.toMatchObject({ code: "pdf_extraction_limit" });
  expect(destroy).toHaveBeenCalledOnce();
  if (budget !== "pages") expect(cleanup).toHaveBeenCalledOnce();
});

it("does not start a worker when already aborted", async () => {
  const controller = new AbortController();
  controller.abort();
  await expect(extractPdfLines(new File(["test"], "test.pdf"), "secret", controller.signal)).rejects.toMatchObject({ code: "invalid_pdf" });
  expect(mock.getDocument).not.toHaveBeenCalled();
});

it("maps file read failures to safe errors", async () => {
  const file = new File(["test"], "test.pdf");
  vi.spyOn(file, "arrayBuffer").mockRejectedValue(new Error("sensitive detail"));
  await expect(extractPdfLines(file, "secret")).rejects.toMatchObject({ code: "invalid_pdf", message: expect.not.stringContaining("sensitive") });
});

it("reports missing built-ins as reader unavailable with a short code, logging only the error name", async () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  try {
    mock.getDocument.mockReturnValue({ promise: Promise.reject(new TypeError("Promise.try is not a function")), destroy: vi.fn().mockResolvedValue(undefined) });
    await expect(extractPdfLines(new File(["test"], "test.pdf"), "secret")).rejects.toMatchObject({ code: "pdf_reader_unavailable", detail: "worker:ReferenceError,main:TypeError" });
    expect(warn).toHaveBeenCalledWith("[pdf-import] main: TypeError");
    expect(JSON.stringify(warn.mock.calls)).not.toContain("Promise.try");
  } finally { warn.mockRestore(); }
});

it("logs the PasswordException name without the password", async () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  try {
    mock.getDocument.mockReturnValue({ promise: Promise.reject(Object.assign(new Error("x"), { name: "PasswordException", code: 1 })), destroy: vi.fn().mockResolvedValue(undefined) });
    await expect(extractPdfLines(new File(["test"], "test.pdf"), "hunter2-synthetic")).rejects.toMatchObject({ code: "password_required" });
    expect(warn).toHaveBeenCalledWith("[pdf-import] main: PasswordException");
    expect(JSON.stringify(warn.mock.calls)).not.toContain("hunter2-synthetic");
  } finally { warn.mockRestore(); }
});

describe("dedicated worker with main-thread fallback", () => {
  type Behaviour = "ready" | "error" | "silent";
  let behaviour: Behaviour = "ready";
  const instances: FakeWorker[] = [];
  class FakeWorker extends EventTarget {
    terminate = vi.fn();
    constructor(public url: URL, public options?: WorkerOptions) {
      super();
      instances.push(this);
      queueMicrotask(() => {
        if (behaviour === "ready") this.dispatchEvent(Object.assign(new Event("message"), { data: { sourceName: "worker", targetName: "main", action: "ready" } }));
        if (behaviour === "error") this.dispatchEvent(new Event("error"));
      });
    }
  }
  const ok = () => ({ promise: Promise.resolve({ numPages: 1, getPage: async () => ({ getTextContent: async () => ({ items: [{ str: "Row", transform: [1, 0, 0, 1, 0, 0], width: 1, height: 1 }] }), cleanup: () => {} }) }), destroy: vi.fn().mockResolvedValue(undefined) });
  beforeEach(() => { instances.length = 0; behaviour = "ready"; vi.stubGlobal("Worker", FakeWorker); vi.spyOn(console, "warn").mockImplementation(() => {}); });
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it("uses a bundled same-origin worker and terminates it afterwards", async () => {
    mock.getDocument.mockReturnValue(ok());
    await expect(extractPdfLines(new File(["x"], "x.pdf"), "")).resolves.toHaveLength(1);
    expect(instances).toHaveLength(1);
    expect(mock.createWorker).toHaveBeenCalledWith({ port: instances[0] });
    expect(mock.getDocument.mock.calls[0][0].worker).toMatchObject({ port: instances[0] });
    expect(String(instances[0].url)).not.toMatch(/cdn|unpkg|jsdelivr/);
    expect(instances[0].terminate).toHaveBeenCalled();
  });

  it("falls back to the main thread when the worker fails to start", async () => {
    behaviour = "error";
    mock.getDocument.mockReturnValue(ok());
    await expect(extractPdfLines(new File(["x"], "x.pdf"), "")).resolves.toHaveLength(1);
    expect(mock.getDocument).toHaveBeenCalledOnce();
    expect(mock.getDocument.mock.calls[0][0]).not.toHaveProperty("worker");
    expect(console.warn).toHaveBeenCalledWith("[pdf-import] worker: WorkerError");
  });

  it("falls back to the main thread when the worker never reports ready", async () => {
    vi.useFakeTimers();
    try {
      behaviour = "silent";
      mock.getDocument.mockReturnValue(ok());
      const result = extractPdfLines(new File(["x"], "x.pdf"), "");
      await vi.advanceTimersByTimeAsync(PDF_WORKER_READY_MS);
      await expect(result).resolves.toHaveLength(1);
      expect(console.warn).toHaveBeenCalledWith("[pdf-import] worker: WorkerTimeout");
    } finally { vi.useRealTimers(); }
  });

  it("falls back when the worker hits a reader error, but not for password results", async () => {
    mock.getDocument.mockReturnValueOnce({ promise: Promise.reject(new TypeError("boom")), destroy: vi.fn().mockResolvedValue(undefined) }).mockReturnValueOnce(ok());
    await expect(extractPdfLines(new File(["x"], "x.pdf"), "pw")).resolves.toHaveLength(1);
    expect(mock.getDocument.mock.calls[1][0].password).toBe("pw");
    mock.getDocument.mockReset();
    mock.getDocument.mockReturnValue({ promise: Promise.reject(Object.assign(new Error("x"), { name: "PasswordException", code: 2 })), destroy: vi.fn().mockResolvedValue(undefined) });
    await expect(extractPdfLines(new File(["x"], "x.pdf"), "bad")).rejects.toMatchObject({ code: "password_incorrect" });
    expect(mock.getDocument).toHaveBeenCalledOnce();
  });
});
