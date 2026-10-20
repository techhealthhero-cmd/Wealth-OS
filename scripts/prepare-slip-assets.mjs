/** Build-time only: never run in the browser; no slip data is accepted. */
import { mkdtemp, mkdir, readdir, copyFile, rm, writeFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { gzipSync } from "node:zlib";
const root = path.resolve("public/ocr");
const temp = await mkdtemp(path.join(tmpdir(), "slip-assets-"));
async function unpack(name, version) {
  const dir = path.join(temp, name);
  await mkdir(dir);
  const output = execFileSync("npm", ["pack", `${name}@${version}`, "--json", "--ignore-scripts"], { cwd: dir, encoding: "utf8" });
  const [{ filename }] = JSON.parse(output);
  execFileSync("tar", ["-xf", path.join(dir, filename), "-C", dir]);
  return path.join(dir, "package");
}
try {
  await mkdir(path.join(root, "core"), { recursive: true });
  await mkdir(path.join(root, "lang"), { recursive: true });
  const qr = await unpack("jsqr", "1.4.0");
  const api = await unpack("tesseract.js", "7.0.0");
  const core = await unpack("tesseract.js-core", "7.0.0");
  await copyFile(path.join(qr, "dist/jsQR.js"), path.join(root, "jsQR.js"));
  for (const name of ["tesseract.esm.min.js", "worker.min.js"]) await copyFile(path.join(api, "dist", name), path.join(root, name));
  for (const name of await readdir(core)) {
    if (/^tesseract-core.*\.(?:wasm|js)$/.test(name)) await copyFile(path.join(core, name), path.join(root, "core", name));
  }
  for (const [name, dir] of [["jsqr", qr], ["tesseract", api], ["core", core]]) {
    const license = (await readdir(dir)).find(file => /^license/i.test(file));
    if (!license) throw new Error(`Missing license for ${name}`);
    await copyFile(path.join(dir, license), path.join(root, `LICENSE-${name}`));
  }
  // Official LSTM-compatible model release, fixed tag rather than a moving branch.
  for (const lang of ["tha", "eng"]) {
    const response = await fetch(`https://raw.githubusercontent.com/tesseract-ocr/tessdata_fast/4.1.0/${lang}.traineddata`);
    if (!response.ok) throw new Error(`Model ${lang}: HTTP ${response.status}`);
    await writeFile(path.join(root, "lang", `${lang}.traineddata.gz`), gzipSync(Buffer.from(await response.arrayBuffer())));
  }
  const license = await fetch("https://raw.githubusercontent.com/tesseract-ocr/tessdata_fast/4.1.0/LICENSE");
  if (!license.ok) throw new Error("Model license download failed");
  await writeFile(path.join(root, "LICENSE-models"), await license.text());
  let total = 0;
  for (const entry of await readdir(root, { recursive: true })) {
    const file = path.join(root, entry);
    const info = await stat(file);
    if (info.isFile()) { console.log(`${entry}: ${info.size} bytes`); total += info.size; }
  }
  console.log(`Total slip assets: ${total} bytes`);
} finally { await rm(temp, { recursive: true, force: true }); }
