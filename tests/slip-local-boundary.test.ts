import { afterEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { createLocalSlipOCR, recognizeSlipText } from "@/features/capture/lib/local-slip-ocr";
import { localSlipQRDecoder } from "@/features/capture/lib/local-slip-qr";
const root = path.resolve("src");
afterEach(() => vi.unstubAllGlobals());
describe("local-only boundary", () => {
  it("walks every local runtime import, forbidding external AI and capture actions", () => {
    const visited = new Set<string>();
    function walk(file: string) {
      if (visited.has(file)) return;
      visited.add(file);
      expect(file).not.toContain("/features/ai/");
      expect(file).not.toMatch(/\/features\/capture\/actions\./);
      const source = fs.readFileSync(file, "utf8");
      expect(source).not.toMatch(/\bscanReceipt\b/);
      const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
      const imports: string[] = [];
      function visit(node: ts.Node) {
        if (ts.isImportDeclaration(node) && !node.importClause?.isTypeOnly && ts.isStringLiteral(node.moduleSpecifier)) imports.push(node.moduleSpecifier.text);
        if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword && ts.isStringLiteral(node.arguments[0])) imports.push(node.arguments[0].text);
        ts.forEachChild(node, visit);
      }
      visit(ast);
      for (const specifier of imports) {
        if (!specifier.startsWith(".") && !specifier.startsWith("@/")) continue;
        const base = specifier.startsWith("@/") ? path.join(root, specifier.slice(2)) : path.resolve(path.dirname(file), specifier);
        const target = [base + ".ts", base + ".tsx", path.join(base, "index.ts")].find(candidate => fs.existsSync(candidate));
        expect(target, `resolve ${specifier}`).toBeTruthy();
        walk(target!);
      }
    }
    for (const name of ["lib/slip/batch.ts", "lib/slip/qr.ts", "features/capture/lib/local-slip-ocr.ts", "features/capture/lib/local-slip-ocr-worker.ts", "features/capture/lib/local-slip-qr.ts", "features/capture/lib/slip-batch-import.ts"]) walk(path.join(root, name));
    expect(visited.size).toBeGreaterThan(8);
  });
  it("imports safely under SSR and rejects browser work without loading assets", async () => {
    await expect(recognizeSlipText(new Blob())).rejects.toThrow("browser");
    await expect(localSlipQRDecoder.decode(new Blob())).rejects.toThrow("browser");
  });
  it("terminates the isolated worker on initialization errors and timeout", async () => {
    vi.stubGlobal("window", { location: { origin: "https://wealth.test" } });
    const terminate = vi.fn();
    let onmessage: ((event: { data: { error: string } }) => void) | undefined;
    let fail = true;
    vi.stubGlobal("Worker", class {
      set onmessage(callback: typeof onmessage) { onmessage = callback; }
      onerror = null;
      postMessage() { if (fail) onmessage?.({ data: { error: "initialization" } }); }
      terminate = terminate;
    });
    await expect(recognizeSlipText(new Blob())).rejects.toThrow("Local OCR failed");
    expect(terminate).toHaveBeenCalledTimes(1);
    vi.useFakeTimers();
    try {
      fail = false;
      const recognition = recognizeSlipText(new Blob());
      const assertion = expect(recognition).rejects.toThrow("timed out");
      await vi.advanceTimersByTimeAsync(120_000);
      await assertion;
      expect(terminate).toHaveBeenCalledTimes(2);
    } finally { vi.useRealTimers(); }
  });
  it("serializes workers, terminates on success/failure, and recovers for the next image", async () => {
    vi.stubGlobal("window", { location: { origin: "https://wealth.test" } });
    const events: string[] = [];
    let count = 0;
    const createWorker = vi.fn(async () => {
      const id = ++count;
      events.push(`create:${id}`);
      return {
        recognize: async () => { events.push(`read:${id}`); if (id === 2) throw Error("ocr failed"); return { data: { text: "synthetic", confidence: 95 } }; },
        terminate: async () => { events.push(`terminate:${id}`); },
      };
    });
    const ocr = createLocalSlipOCR(async () => ({ createWorker }));
    const results = await Promise.allSettled([1, 2, 3].map(() => ocr.recognizeSlipText(new Blob())));
    expect(results.map(result => result.status)).toEqual(["fulfilled", "rejected", "fulfilled"]);
    expect(events).toEqual(["create:1", "read:1", "terminate:1", "create:2", "read:2", "terminate:2", "create:3", "read:3", "terminate:3"]);
    expect(createWorker).toHaveBeenCalledWith("tha+eng", 1, expect.objectContaining({ workerPath: "https://wealth.test/ocr/worker.min.js", langPath: "https://wealth.test/ocr/lang/", corePath: "https://wealth.test/ocr/core/", workerBlobURL: false, cacheMethod: "none" }));
  });
});
