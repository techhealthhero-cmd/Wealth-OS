// Cuts the four AI Coach drawings out of their sheet
// (assets/artwork/drafts/ai-coach-concept-v1-gouache-ink.png, 1254x1254,
// a 2x2 grid) into one rounded square WebP each under public/artwork/ai/.
// No robot or mascot, by the roadmap's rule: notebooks, a calendar, a map.
//
//   node scripts/artwork/crop-ai-coach-art.mjs
//
// Boxes are [left, top] in sheet pixels; every box is BOX x BOX.
import { mkdirSync } from "node:fs";
import sharp from "sharp";

const SHEET = "assets/artwork/drafts/ai-coach-concept-v1-gouache-ink.png";
const OUT = "public/artwork/ai";
const BOX = 585;
const SIZE = 256;

const BOXES = {
  reading: [30, 22], // notebook under a magnifier, notes sorted into a stack
  "monthly-advice": [645, 22], // calendar and a compass card
  "next-best-action": [28, 632], // map, three routes meeting at one tick
  explain: [642, 645], // busy chart page turned into three clear cards
};

const RADIUS = Math.round(SIZE * 0.2);
const mask = Buffer.from(
  `<svg width="${SIZE}" height="${SIZE}"><rect width="${SIZE}" height="${SIZE}" rx="${RADIUS}" ry="${RADIUS}" fill="#fff"/></svg>`
);

mkdirSync(OUT, { recursive: true });
for (const [key, [left, top]] of Object.entries(BOXES)) {
  const square = await sharp(SHEET)
    .extract({ left, top, width: BOX, height: BOX })
    .resize(SIZE, SIZE)
    .png()
    .toBuffer();
  await sharp(square)
    .ensureAlpha()
    .composite([{ input: mask, blend: "dest-in" }])
    .webp({ quality: 82 })
    .toFile(`${OUT}/${key}.webp`);
  console.log(`${OUT}/${key}.webp`);
}
