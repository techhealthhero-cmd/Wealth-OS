import { beforeEach, describe, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({ getDocument: vi.fn(), worker: { workerSrc: "" } }));
vi.mock("pdfjs-dist", () => ({ getDocument: mock.getDocument, GlobalWorkerOptions: mock.worker, PasswordResponses: { INCORRECT_PASSWORD: 2 } }));
import { extractPdfLines, PDF_IMPORT_MAX_BYTES } from "../src/features/statement-import/pdf-extract";

beforeEach(() => { vi.clearAllMocks(); });

describe("browser PDF boundary", () => {
  it("passes bytes only to the local worker and destroys it after extraction", async () => {
    const cleanup = vi.fn();
    const destroy = vi.fn().mockResolvedValue(undefined);
    const items = [{ str: "Synthetic", transform: [1, 0, 0, 1, 10, 30], width: 50, height: 10 }];
    mock.getDocument.mockReturnValue({ promise: Promise.resolve({ numPages: 1, getPage: async () => ({ getTextContent: async () => ({ items }), cleanup }) }), destroy });
    const result = await extractPdfLines(new File(["synthetic PDF bytes"], "synthetic.pdf"), "synthetic-password");
    expect(result[0].text).toBe("Synthetic");
    expect(mock.getDocument).toHaveBeenCalledWith(expect.objectContaining({ data: expect.any(Uint8Array), password: "synthetic-password", verbosity: 0, useWorkerFetch: false }));
    expect(mock.getDocument.mock.calls[0][0]).not.toHaveProperty("url");
    expect(mock.worker.workerSrc).toContain("pdfjs-dist/build/pdf.worker.min.mjs");
    expect(mock.worker.workerSrc).not.toMatch(/cdn|unpkg|jsdelivr/);
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
