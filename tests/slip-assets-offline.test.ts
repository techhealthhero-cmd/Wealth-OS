import { expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, symlinkSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { gunzipSync } from "node:zlib";

it("prepares usable OCR assets from installed packages without network or npm", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "slip-offline-test-"));
  try {
    mkdirSync(path.join(dir, "scripts"));
    // Keep module resolution local while writing into an empty output directory.
    symlinkSync(path.resolve("node_modules"), path.join(dir, "node_modules"), "dir");
    const script = readFileSync("scripts/prepare-slip-assets.mjs", "utf8");
    const bootstrap = `globalThis.fetch = () => { throw new Error("Network forbidden"); };\n${script}`;
    execFileSync(process.execPath, ["--input-type=module", "-e", bootstrap], {
      cwd: dir, env: { ...process.env, PATH: "" }, timeout: 30_000,
    });
    for (const name of ["jsQR.js", "tesseract.esm.min.js", "worker.min.js", "LICENSE-jsqr", "LICENSE-tesseract", "LICENSE-core", "LICENSE-models"]) {
      expect(readFileSync(path.join(dir, "public/ocr", name)).length).toBeGreaterThan(0);
    }
    const wasm = readFileSync(path.join(dir, "public/ocr/core/tesseract-core-lstm.wasm"));
    expect([...wasm.subarray(0, 4)]).toEqual([0, 97, 115, 109]);
    for (const lang of ["eng", "tha"]) {
      expect(gunzipSync(readFileSync(path.join(dir, `public/ocr/lang/${lang}.traineddata.gz`))).length).toBeGreaterThan(100_000);
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
