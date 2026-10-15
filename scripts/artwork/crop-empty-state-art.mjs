// Cuts the six empty-state drawings out of their sheet
// (assets/artwork/drafts/empty-states-concept-v1-gouache-ink.png,
// 1254x1254, 2 columns x 3 rows) into one rounded 3:2 WebP each under
// public/artwork/empty/, same frame as the net-worth set.
//
//   node scripts/artwork/crop-empty-state-art.mjs
//
// Boxes are [left, top] in sheet pixels; every box is BOX_W x BOX_H.
import { mkdirSync } from "node:fs";
import sharp from "sharp";

const SHEET = "assets/artwork/drafts/empty-states-concept-v1-gouache-ink.png";
const OUT = "public/artwork/empty";
const BOX_W = 570;
const BOX_H = 380;
const W = 360;
const H = 240;

const BOXES = {
  assets: [38, 28], // open box with a blank card, key
  liabilities: [648, 25], // empty clipboard checklist, blocks, pencil
  notifications: [38, 440], // service bell, notebook, blank pinned note
  "money-year": [648, 438], // open planner with blank month boxes
  forecast: [38, 828], // folded map with two routes, compass
  "ai-conversation": [648, 828], // open book with blank speech bubbles
};

const RADIUS = Math.round(H * 0.18);
const mask = Buffer.from(
  `<svg width="${W}" height="${H}"><rect width="${W}" height="${H}" rx="${RADIUS}" ry="${RADIUS}" fill="#fff"/></svg>`
);

mkdirSync(OUT, { recursive: true });
for (const [key, [left, top]] of Object.entries(BOXES)) {
  const frame = await sharp(SHEET)
    .extract({ left, top, width: BOX_W, height: BOX_H })
    .resize(W, H)
    .png()
    .toBuffer();
  await sharp(frame)
    .ensureAlpha()
    .composite([{ input: mask, blend: "dest-in" }])
    .webp({ quality: 82 })
    .toFile(`${OUT}/${key}.webp`);
  console.log(`${OUT}/${key}.webp`);
}
