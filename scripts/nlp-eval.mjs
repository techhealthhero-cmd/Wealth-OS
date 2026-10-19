import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Use a fresh path so failed runs cannot print a stale successful report.
const directory = mkdtempSync(join(tmpdir(), "wealth-nlp-eval-"));
try {
  const reportPath = join(directory, "report.json");
  execFileSync(process.execPath, ["node_modules/vitest/vitest.mjs", "run", "tests/nlp-corpus.test.ts", "--configLoader", "runner"], {
    stdio: "inherit",
    env: { ...process.env, NLP_REPORT_PATH: reportPath },
  });
  process.stdout.write(readFileSync(reportPath, "utf8"));
} finally {
  rmSync(directory, { recursive: true, force: true });
}
