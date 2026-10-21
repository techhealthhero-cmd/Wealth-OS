/** Build-time only: copy pinned dependencies without network access or slip data. */
import { mkdir, readdir, copyFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const root = path.resolve("public/ocr");
const packageRoot = name => path.dirname(require.resolve(`${name}/package.json`));
await mkdir(path.join(root, "core"), { recursive: true });
await mkdir(path.join(root, "lang"), { recursive: true });
const qr = packageRoot("jsqr");
const api = packageRoot("tesseract.js");
const core = packageRoot("tesseract.js-core");
await copyFile(path.join(qr, "dist/jsQR.js"), path.join(root, "jsQR.js"));
for (const name of ["tesseract.esm.min.js", "worker.min.js"]) {
  await copyFile(path.join(api, "dist", name), path.join(root, name));
}
for (const name of await readdir(core)) {
  if (/^tesseract-core.*\.(?:wasm|js)$/.test(name)) {
    await copyFile(path.join(core, name), path.join(root, "core", name));
  }
}
for (const [name, dir] of [["jsqr", qr], ["tesseract", api], ["core", core]]) {
  const license = (await readdir(dir)).find(file => /^license/i.test(file));
  if (!license) throw new Error(`Missing license for ${name}`);
  await copyFile(path.join(dir, license), path.join(root, `LICENSE-${name}`));
}
const modelNotices = [];
for (const lang of ["tha", "eng"]) {
  const name = `@tesseract.js-data/${lang}`;
  const dir = packageRoot(name);
  // Integer LSTM models, as used by Tesseract.js's default fast reader.
  await copyFile(path.join(dir, "4.0.0_best_int", `${lang}.traineddata.gz`), path.join(root, "lang", `${lang}.traineddata.gz`));
  modelNotices.push({ ...require(`${name}/package.json`), model: `4.0.0_best_int/${lang}.traineddata.gz` });
}
await writeFile(path.join(root, "LICENSE-models"), JSON.stringify(modelNotices, null, 2) + "\n");
console.log("Prepared local slip assets from node_modules (offline).");
